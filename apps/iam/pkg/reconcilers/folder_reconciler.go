package reconcilers

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	foldersKind "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

type FolderReconciler struct {
	zanzanaClient zanzana.Client
}

// batch will call fn with a batch of T for specified size.
func batch[T any](items []T, batchSize int, fn func([]T) error) error {
	count := len(items)
	for i := 0; i < count; {
		end := i + batchSize
		if end > count {
			end = count
		}

		if err := fn(items[i:end]); err != nil {
			return err
		}

		i = end
	}
	return nil
}

func extractFolderAndParentUIDs(folder *foldersKind.Folder) (string, string, error) {
	f_uid := folder.ObjectMeta.Name

	if f_uid == "" {
		return "", "", fmt.Errorf("folder UID is empty")
	}

	fullpathUIDs, ok := folder.ObjectMeta.Annotations["grafana.app/fullpathUIDs"]

	if !ok {
		return "", "", fmt.Errorf("Fullpath annotation not found", "folder", f_uid)
	}

	// Parse the fullpathUIDs to extract parent folder
	pathSegments := strings.Split(fullpathUIDs, "/")

	// Check if the last segment matches the current folder UID
	if len(pathSegments) == 0 || pathSegments[len(pathSegments)-1] != f_uid {
		return "", "", fmt.Errorf("folder UID '%s' does not match last segment in path '%s'", f_uid, fullpathUIDs)
	}

	// If there's only one segment, this is a root folder
	if len(pathSegments) == 1 {
		return "", f_uid, nil
	}

	// Get the parent folder UID (second to last segment)
	parentFolderUID := pathSegments[len(pathSegments)-2]

	return parentFolderUID, f_uid, nil
}

func (r *FolderReconciler) listFolderRelations(ctx context.Context, folder_uid string, namespace string) ([]*openfgav1.TupleKey, error) {
	object := zanzana.NewTupleEntry(zanzana.TypeFolder, folder_uid, "")
	relation := zanzana.RelationParent

	list, err := r.zanzanaClient.Read(ctx, &authzextv1.ReadRequest{
		Namespace: namespace,
		TupleKey: &authzextv1.ReadRequestTupleKey{
			Object:   object,
			Relation: relation,
		},
	})

	if err != nil {
		return nil, err
	}

	c := list.ContinuationToken

	for c != "" {
		res, err := r.zanzanaClient.Read(ctx, &authzextv1.ReadRequest{
			ContinuationToken: c,
			Namespace:         namespace,
			TupleKey: &authzextv1.ReadRequestTupleKey{
				Object:   object,
				Relation: relation,
			},
		})
		if err != nil {
			return nil, err
		}

		c = res.ContinuationToken
		list.Tuples = append(list.Tuples, res.Tuples...)
	}

	openfgaTuples := zanzana.ToOpenFGATuples(list.Tuples)
	openfgaTupleKeys := make([]*openfgav1.TupleKey, 0, len(openfgaTuples))

	for _, t := range openfgaTuples {
		openfgaTupleKeys = append(openfgaTupleKeys, t.Key)
	}

	return openfgaTupleKeys, nil
}

func (r *FolderReconciler) handleUpdateFolder(ctx context.Context, folder *foldersKind.Folder) (operator.ReconcileResult, error) {
	logger := logging.FromContext(ctx)

	namespace := folder.Namespace
	if namespace == "" {
		return operator.ReconcileResult{}, fmt.Errorf("namespace is empty")
	}

	parent_uid, folder_uid, err := extractFolderAndParentUIDs(folder)

	if err != nil {
		logger.Error("Error extracting folder and parent UID", "error", err)
		return operator.ReconcileResult{}, err
	}

	tuples, err := r.listFolderRelations(ctx, folder_uid, namespace)
	if err != nil {
		logger.Error("Error listing folder relations", "error", err)
		requeueAfter := 10 * time.Second
		return operator.ReconcileResult{RequeueAfter: &requeueAfter}, err
	}

	deletes := []*openfgav1.TupleKeyWithoutCondition{}

	if parent_uid == "" {
		if len(tuples) == 0 {
			logger.Info("Root folder reconcilation completed", "folder", folder_uid)
			return operator.ReconcileResult{}, nil
		}

		for _, t := range tuples {
			logger.Info("Adding tuple to delete", "tuple.User", t.User, "tuple.Relation", t.Relation, "tuple.Object", t.Object)
			deletes = append(deletes, &openfgav1.TupleKeyWithoutCondition{
				User:     t.User,
				Relation: t.Relation,
				Object:   t.Object,
			})
		}
	} else {
		found_relation := false
		for _, t := range tuples {
			if strings.Contains(t.User, parent_uid) && strings.Contains(t.Object, folder_uid) {
				logger.Info("Found relation", "tuple.User", t.User, "tuple.Relation", t.Relation, "tuple.Object", t.Object)
				found_relation = true
			} else {
				deletes = append(deletes, &openfgav1.TupleKeyWithoutCondition{
					User:     t.User,
					Relation: t.Relation,
					Object:   t.Object,
				})
			}
		}
		if !found_relation {
			logger.Info("Adding tuple to create", "tuple.User", parent_uid, "tuple.Relation", zanzana.RelationParent, "tuple.Object", folder_uid)
			r.zanzanaClient.Write(ctx, &authzextv1.WriteRequest{
				Namespace: namespace,
				Writes: &authzextv1.WriteRequestWrites{TupleKeys: []*authzextv1.TupleKey{
					{
						User:     parent_uid,
						Relation: zanzana.RelationParent,
						Object:   folder_uid,
					},
				}},
			})
		}
	}

	if len(deletes) > 0 {
		err := batch(deletes, 100, func(items []*openfgav1.TupleKeyWithoutCondition) error {
			return r.zanzanaClient.Write(ctx, &authzextv1.WriteRequest{
				Namespace: namespace,
				Deletes:   &authzextv1.WriteRequestDeletes{TupleKeys: zanzana.ToAuthzExtTupleKeysWithoutCondition(items)},
			})
		})

		if err != nil {
			return operator.ReconcileResult{}, err
		}
	}

	return operator.ReconcileResult{}, nil
}

func (r *FolderReconciler) handleDeleteFolder(ctx context.Context, folder *foldersKind.Folder) (operator.ReconcileResult, error) {
	logger := logging.FromContext(ctx)

	namespace := folder.Namespace
	folder_uid := folder.Spec.Title

	tuples, err := r.listFolderRelations(ctx, folder_uid, namespace)
	if err != nil {
		logger.Error("Error listing folder relations", "error", err)
		requeueAfter := 10 * time.Second
		return operator.ReconcileResult{RequeueAfter: &requeueAfter}, err
	}

	if len(tuples) == 0 {
		logger.Info("Folder has no relations, skipping deletion", "folder", folder_uid)
		return operator.ReconcileResult{}, nil
	}

	deletes := []*openfgav1.TupleKeyWithoutCondition{}

	for _, t := range tuples {
		logger.Info("Deleting tuple", "tuple.User", t.User, "tuple.Relation", t.Relation, "tuple.Object", t.Object)
		deletes = append(deletes, &openfgav1.TupleKeyWithoutCondition{
			User:     t.User,
			Relation: t.Relation,
			Object:   t.Object,
		})
	}

	if err = batch(deletes, 100, func(items []*openfgav1.TupleKeyWithoutCondition) error {
		return r.zanzanaClient.Write(ctx, &authzextv1.WriteRequest{
			Namespace: namespace,
			Deletes:   &authzextv1.WriteRequestDeletes{TupleKeys: zanzana.ToAuthzExtTupleKeysWithoutCondition(items)},
		})
	}); err != nil {
		return operator.ReconcileResult{}, err
	}

	return operator.ReconcileResult{}, nil
}

func (r *FolderReconciler) Reconcile(ctx context.Context, req operator.TypedReconcileRequest[*foldersKind.Folder]) (operator.ReconcileResult, error) {
	logger := logging.FromContext(ctx)

	// Log all contents of the req object as JSON
	reqJSON, err := json.MarshalIndent(req, "", "  ")
	if err != nil {
		logger.Error("Failed to marshal req object to JSON", "error", err)
	} else {
		logger.Info("Reconcile request received", "req", string(reqJSON))
	}

	switch req.Action {
	case operator.ReconcileActionCreated:
		return r.handleUpdateFolder(ctx, req.Object)
	case operator.ReconcileActionUpdated:
		return r.handleUpdateFolder(ctx, req.Object)
	case operator.ReconcileActionDeleted:
		return r.handleDeleteFolder(ctx, req.Object)
	default:
		return operator.ReconcileResult{}, nil
	}
}

func NewFolderReconciler(patchClient operator.PatchClient, zanzanaClient zanzana.Client) (operator.Reconciler, error) {
	reconciler, err := operator.NewOpinionatedReconciler(patchClient, "folder-iam-finalizer")

	if err != nil {
		return nil, err
	}

	folderReconciler := &FolderReconciler{
		zanzanaClient: zanzanaClient,
	}

	reconciler.Reconciler = &operator.TypedReconciler[*foldersKind.Folder]{
		ReconcileFunc: folderReconciler.Reconcile,
	}

	return reconciler, err
}
