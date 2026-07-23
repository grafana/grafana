package configmap

import (
	"context"
	//nolint:gosec
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"net/http"
	"path"
	"sort"
	"strings"
	"sync/atomic"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
	typedcorev1 "k8s.io/client-go/kubernetes/typed/core/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
)

var (
	_ repository.Repository = (*configMapRepository)(nil)
	_ repository.Writer     = (*configMapRepository)(nil)
	_ repository.Reader     = (*configMapRepository)(nil)
)

type configMapRepository struct {
	config   *provisioning.Repository
	clients  ClientProvider
	maxBytes atomic.Int64
}

// NewRepository builds a ConfigMap-backed repository.
func NewRepository(config *provisioning.Repository, clients ClientProvider) *configMapRepository {
	if clients == nil {
		clients = InClusterClientProvider()
	}
	return &configMapRepository{config: config, clients: clients}
}

func (r *configMapRepository) Config() *provisioning.Repository {
	return r.config
}

func (r *configMapRepository) WithMaxFileSize(maxBytes int64) {
	r.maxBytes.Store(maxBytes)
}

func (r *configMapRepository) cfg() *provisioning.ConfigMapRepositoryConfig {
	if r.config.Spec.ConfigMap == nil {
		return &provisioning.ConfigMapRepositoryConfig{}
	}
	return r.config.Spec.ConfigMap
}

func (r *configMapRepository) namespace() string {
	if ns := r.cfg().Namespace; ns != "" {
		return ns
	}
	return r.config.Namespace
}

func (r *configMapRepository) core() (typedcorev1.CoreV1Interface, error) {
	client, err := r.clients.Kubernetes()
	if err != nil {
		return nil, err
	}
	return client.CoreV1(), nil
}

func (r *configMapRepository) validateRequest(ref string) error {
	if ref != "" {
		return apierrors.NewBadRequest("configmap repository does not support ref")
	}
	return nil
}

func (r *configMapRepository) Test(ctx context.Context) (*provisioning.TestResults, error) {
	fld := field.NewPath("spec", "configmap")
	if r.config.Spec.ConfigMap == nil {
		return repository.FromFieldError(field.Required(fld, "no configmap is configured")), nil
	}
	core, err := r.core()
	if err != nil {
		return repository.FromFieldError(field.Invalid(fld, r.cfg(), err.Error())), nil
	}
	ns := r.namespace()
	cfg := r.cfg()
	if cfg.Name != "" {
		_, err = core.ConfigMaps(ns).Get(ctx, cfg.Name, metav1.GetOptions{})
		if apierrors.IsNotFound(err) {
			return repository.FromFieldError(field.NotFound(fld.Child("name"), cfg.Name)), nil
		}
		if err != nil {
			return repository.FromFieldError(field.Invalid(fld.Child("name"), cfg.Name, err.Error())), nil
		}
	} else {
		_, err = core.ConfigMaps(ns).List(ctx, metav1.ListOptions{LabelSelector: cfg.LabelSelector, Limit: 1})
		if err != nil {
			return repository.FromFieldError(field.Invalid(fld.Child("labelSelector"), cfg.LabelSelector, err.Error())), nil
		}
	}
	return &provisioning.TestResults{Code: http.StatusOK, Success: true}, nil
}

func (r *configMapRepository) Read(ctx context.Context, filePath string, ref string) (*repository.FileInfo, error) {
	if err := r.validateRequest(ref); err != nil {
		return nil, err
	}
	if safepath.IsDir(filePath) {
		entries, err := r.ReadTree(ctx, ref)
		if err != nil {
			return nil, err
		}
		prefix := strings.Trim(filePath, "/")
		if prefix != "" {
			prefix += "/"
		}
		for _, e := range entries {
			if prefix == "" || strings.HasPrefix(e.Path, prefix) || e.Path+"/" == prefix {
				return &repository.FileInfo{Path: strings.Trim(filePath, "/")}, nil
			}
		}
		return nil, repository.ErrFileNotFound
	}

	data, hash, err := r.readFile(ctx, filePath)
	if err != nil {
		return nil, err
	}
	if max := r.maxBytes.Load(); max > 0 && int64(len(data)) > max {
		return nil, apierrors.NewRequestEntityTooLargeError(
			fmt.Sprintf("file %q is %d bytes; max allowed is %d bytes", filePath, len(data), max),
		)
	}
	return &repository.FileInfo{Path: strings.Trim(filePath, "/"), Data: data, Hash: hash}, nil
}

func (r *configMapRepository) readFile(ctx context.Context, filePath string) ([]byte, string, error) {
	core, err := r.core()
	if err != nil {
		return nil, "", err
	}
	cfg := r.cfg()
	ns := r.namespace()
	filePath = strings.Trim(filePath, "/")

	if cfg.Name != "" {
		key, err := encodeKey(filePath, cfg.KeyPrefix)
		if err != nil {
			return nil, "", apierrors.NewBadRequest(err.Error())
		}
		cm, err := core.ConfigMaps(ns).Get(ctx, cfg.Name, metav1.GetOptions{})
		if apierrors.IsNotFound(err) {
			return nil, "", repository.ErrFileNotFound
		}
		if err != nil {
			return nil, "", err
		}
		val, ok := cm.Data[key]
		if !ok {
			return nil, "", repository.ErrFileNotFound
		}
		return []byte(val), hashBytes([]byte(val)), nil
	}

	parts := strings.SplitN(filePath, "/", 2)
	if len(parts) != 2 {
		return nil, "", repository.ErrFileNotFound
	}
	cm, err := core.ConfigMaps(ns).Get(ctx, parts[0], metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return nil, "", repository.ErrFileNotFound
	}
	if err != nil {
		return nil, "", err
	}
	val, ok := cm.Data[parts[1]]
	if !ok {
		if key, encErr := encodeKey(parts[1], ""); encErr == nil {
			val, ok = cm.Data[key]
		}
	}
	if !ok {
		return nil, "", repository.ErrFileNotFound
	}
	return []byte(val), hashBytes([]byte(val)), nil
}

func (r *configMapRepository) ReadTree(ctx context.Context, ref string) ([]repository.FileTreeEntry, error) {
	if err := r.validateRequest(ref); err != nil {
		return nil, err
	}
	core, err := r.core()
	if err != nil {
		return nil, err
	}
	cfg := r.cfg()
	ns := r.namespace()

	dirs := map[string]struct{}{}
	var blobs []repository.FileTreeEntry

	addBlob := func(filePath string, size int64, hash string) {
		for _, d := range parentDirs(filePath) {
			dirs[d] = struct{}{}
		}
		blobs = append(blobs, repository.FileTreeEntry{Path: filePath, Size: size, Hash: hash, Blob: true})
	}

	if cfg.Name != "" {
		cm, err := core.ConfigMaps(ns).Get(ctx, cfg.Name, metav1.GetOptions{})
		if apierrors.IsNotFound(err) {
			return []repository.FileTreeEntry{}, nil
		}
		if err != nil {
			return nil, err
		}
		keys := make([]string, 0, len(cm.Data))
		for k := range cm.Data {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			p, ok := decodeKey(k, cfg.KeyPrefix)
			if !ok {
				continue
			}
			val := cm.Data[k]
			addBlob(p, int64(len(val)), hashBytes([]byte(val)))
		}
	} else {
		list, err := core.ConfigMaps(ns).List(ctx, metav1.ListOptions{LabelSelector: cfg.LabelSelector})
		if err != nil {
			return nil, err
		}
		for i := range list.Items {
			cm := &list.Items[i]
			keys := make([]string, 0, len(cm.Data))
			for k := range cm.Data {
				keys = append(keys, k)
			}
			sort.Strings(keys)
			for _, k := range keys {
				decoded, ok := decodeKey(k, "")
				if !ok {
					decoded = k
				}
				filePath := path.Join(cm.Name, decoded)
				val := cm.Data[k]
				addBlob(filePath, int64(len(val)), hashBytes([]byte(val)))
			}
		}
	}

	dirList := make([]string, 0, len(dirs))
	for d := range dirs {
		dirList = append(dirList, d)
	}
	sort.Strings(dirList)
	out := make([]repository.FileTreeEntry, 0, len(dirList)+len(blobs))
	for _, d := range dirList {
		out = append(out, repository.FileTreeEntry{Path: d, Blob: false})
	}
	out = append(out, blobs...)
	return out, nil
}

func (r *configMapRepository) Create(ctx context.Context, filePath string, ref string, data []byte, _ string) error {
	if err := r.validateRequest(ref); err != nil {
		return err
	}
	if safepath.IsDir(filePath) {
		if data != nil {
			return apierrors.NewBadRequest("data cannot be provided for a directory")
		}
		return nil
	}
	_, _, err := r.readFile(ctx, filePath)
	if err == nil {
		return apierrors.NewAlreadyExists(schema.GroupResource{}, filePath)
	}
	if err != repository.ErrFileNotFound {
		return err
	}
	return r.writeFile(ctx, filePath, data)
}

func (r *configMapRepository) Update(ctx context.Context, filePath string, ref string, data []byte, _ string) error {
	if err := r.validateRequest(ref); err != nil {
		return err
	}
	if safepath.IsDir(filePath) {
		return apierrors.NewBadRequest("cannot update a directory")
	}
	if _, _, err := r.readFile(ctx, filePath); err != nil {
		return err
	}
	return r.writeFile(ctx, filePath, data)
}

func (r *configMapRepository) Write(ctx context.Context, filePath, ref string, data []byte, _ string) error {
	if err := r.validateRequest(ref); err != nil {
		return err
	}
	if safepath.IsDir(filePath) {
		return nil
	}
	return r.writeFile(ctx, filePath, data)
}

func (r *configMapRepository) Delete(ctx context.Context, filePath string, ref string, _ string) error {
	if err := r.validateRequest(ref); err != nil {
		return err
	}
	core, err := r.core()
	if err != nil {
		return err
	}
	cfg := r.cfg()
	ns := r.namespace()

	if safepath.IsDir(filePath) {
		prefix := strings.Trim(filePath, "/")
		if prefix != "" {
			prefix += "/"
		}
		entries, err := r.ReadTree(ctx, "")
		if err != nil {
			return err
		}
		for _, e := range entries {
			if !e.Blob {
				continue
			}
			if prefix == "" || strings.HasPrefix(e.Path, prefix) {
				if err := r.Delete(ctx, e.Path, "", ""); err != nil && err != repository.ErrFileNotFound {
					return err
				}
			}
		}
		return nil
	}

	filePath = strings.Trim(filePath, "/")
	if cfg.Name != "" {
		key, err := encodeKey(filePath, cfg.KeyPrefix)
		if err != nil {
			return apierrors.NewBadRequest(err.Error())
		}
		cm, err := core.ConfigMaps(ns).Get(ctx, cfg.Name, metav1.GetOptions{})
		if apierrors.IsNotFound(err) {
			return repository.ErrFileNotFound
		}
		if err != nil {
			return err
		}
		if _, ok := cm.Data[key]; !ok {
			return repository.ErrFileNotFound
		}
		delete(cm.Data, key)
		_, err = core.ConfigMaps(ns).Update(ctx, cm, metav1.UpdateOptions{})
		return err
	}

	parts := strings.SplitN(filePath, "/", 2)
	if len(parts) != 2 {
		return repository.ErrFileNotFound
	}
	cm, err := core.ConfigMaps(ns).Get(ctx, parts[0], metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return repository.ErrFileNotFound
	}
	if err != nil {
		return err
	}
	key := parts[1]
	if _, ok := cm.Data[key]; !ok {
		if enc, encErr := encodeKey(parts[1], ""); encErr == nil {
			key = enc
		}
	}
	if _, ok := cm.Data[key]; !ok {
		return repository.ErrFileNotFound
	}
	delete(cm.Data, key)
	_, err = core.ConfigMaps(ns).Update(ctx, cm, metav1.UpdateOptions{})
	return err
}

func (r *configMapRepository) Move(ctx context.Context, oldPath, newPath, ref, comment string) error {
	if err := r.validateRequest(ref); err != nil {
		return err
	}
	if safepath.IsDir(oldPath) != safepath.IsDir(newPath) {
		return apierrors.NewBadRequest("cannot move between file and directory types")
	}
	if safepath.IsDir(oldPath) {
		entries, err := r.ReadTree(ctx, "")
		if err != nil {
			return err
		}
		oldPrefix := strings.Trim(oldPath, "/") + "/"
		newPrefix := strings.Trim(newPath, "/") + "/"
		for _, e := range entries {
			if !e.Blob || !strings.HasPrefix(e.Path, oldPrefix) {
				continue
			}
			rel := strings.TrimPrefix(e.Path, oldPrefix)
			data, _, err := r.readFile(ctx, e.Path)
			if err != nil {
				return err
			}
			if err := r.Write(ctx, newPrefix+rel, "", data, comment); err != nil {
				return err
			}
			if err := r.Delete(ctx, e.Path, "", comment); err != nil {
				return err
			}
		}
		return nil
	}
	data, _, err := r.readFile(ctx, oldPath)
	if err != nil {
		return err
	}
	if _, _, err := r.readFile(ctx, newPath); err == nil {
		return repository.ErrFileAlreadyExists
	} else if err != repository.ErrFileNotFound {
		return err
	}
	if err := r.Write(ctx, newPath, "", data, comment); err != nil {
		return err
	}
	return r.Delete(ctx, oldPath, "", comment)
}

func (r *configMapRepository) writeFile(ctx context.Context, filePath string, data []byte) error {
	core, err := r.core()
	if err != nil {
		return err
	}
	cfg := r.cfg()
	ns := r.namespace()
	filePath = strings.Trim(filePath, "/")

	if cfg.Name != "" {
		key, err := encodeKey(filePath, cfg.KeyPrefix)
		if err != nil {
			return apierrors.NewBadRequest(err.Error())
		}
		cm, err := core.ConfigMaps(ns).Get(ctx, cfg.Name, metav1.GetOptions{})
		if apierrors.IsNotFound(err) {
			newCM := &corev1.ConfigMap{
				ObjectMeta: metav1.ObjectMeta{Name: cfg.Name, Namespace: ns},
				Data:       map[string]string{key: string(data)},
			}
			if err := ensureUnderLimit(newCM.Data); err != nil {
				return apierrors.NewRequestEntityTooLargeError(err.Error())
			}
			_, err = core.ConfigMaps(ns).Create(ctx, newCM, metav1.CreateOptions{})
			return err
		}
		if err != nil {
			return err
		}
		if cm.Data == nil {
			cm.Data = map[string]string{}
		}
		cm.Data[key] = string(data)
		if err := ensureUnderLimit(cm.Data); err != nil {
			return apierrors.NewRequestEntityTooLargeError(err.Error())
		}
		_, err = core.ConfigMaps(ns).Update(ctx, cm, metav1.UpdateOptions{})
		return err
	}

	parts := strings.SplitN(filePath, "/", 2)
	if len(parts) != 2 {
		return apierrors.NewBadRequest("labelSelector mode requires paths of the form <configmap>/<key>")
	}
	cmName, keyPath := parts[0], parts[1]
	key, err := encodeKey(keyPath, "")
	if err != nil {
		return apierrors.NewBadRequest(err.Error())
	}
	cm, err := core.ConfigMaps(ns).Get(ctx, cmName, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		newCM := &corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{Name: cmName, Namespace: ns},
			Data:       map[string]string{key: string(data)},
		}
		if err := ensureUnderLimit(newCM.Data); err != nil {
			return apierrors.NewRequestEntityTooLargeError(err.Error())
		}
		_, err = core.ConfigMaps(ns).Create(ctx, newCM, metav1.CreateOptions{})
		return err
	}
	if err != nil {
		return err
	}
	if cm.Data == nil {
		cm.Data = map[string]string{}
	}
	cm.Data[key] = string(data)
	if err := ensureUnderLimit(cm.Data); err != nil {
		return apierrors.NewRequestEntityTooLargeError(err.Error())
	}
	_, err = core.ConfigMaps(ns).Update(ctx, cm, metav1.UpdateOptions{})
	return err
}

func hashBytes(data []byte) string {
	//nolint:gosec
	sum := sha1.Sum(data)
	return hex.EncodeToString(sum[:])
}
