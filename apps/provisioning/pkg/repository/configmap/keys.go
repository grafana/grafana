package configmap

import (
	"fmt"
	"path"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation"

	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
)

const pathSepEncode = "__"

// MaxConfigMapBytes is the Kubernetes ConfigMap data size ceiling (~1 MiB).
const MaxConfigMapBytes = 1024 * 1024

// EncodeKey maps a repository file path to a ConfigMap data key.
func EncodeKey(filePath, keyPrefix string) (string, error) {
	return encodeKey(filePath, keyPrefix)
}

func encodeKey(filePath, keyPrefix string) (string, error) {
	filePath = strings.Trim(filePath, "/")
	if filePath == "" {
		return "", fmt.Errorf("empty path")
	}
	if err := safepath.IsSafe(filePath); err != nil {
		return "", err
	}
	if strings.Contains(filePath, pathSepEncode) {
		return "", fmt.Errorf("path must not contain %q", pathSepEncode)
	}
	key := strings.ReplaceAll(filePath, "/", pathSepEncode)
	if keyPrefix != "" {
		key = keyPrefix + key
	}
	if errs := validation.IsConfigMapKey(key); len(errs) > 0 {
		return "", fmt.Errorf("invalid configmap key %q: %s", key, strings.Join(errs, "; "))
	}
	return key, nil
}

// matchLabelsFromSelector extracts equality labels suitable for Create ObjectMeta.
func matchLabelsFromSelector(sel string) (map[string]string, error) {
	if sel == "" {
		return nil, nil
	}
	ls, err := metav1.ParseToLabelSelector(sel)
	if err != nil {
		return nil, err
	}
	out := map[string]string{}
	for k, v := range ls.MatchLabels {
		out[k] = v
	}
	for _, expr := range ls.MatchExpressions {
		if expr.Operator == metav1.LabelSelectorOpIn && len(expr.Values) == 1 {
			out[expr.Key] = expr.Values[0]
		}
	}
	return out, nil
}

func decodeKey(key, keyPrefix string) (string, bool) {
	if keyPrefix != "" {
		if !strings.HasPrefix(key, keyPrefix) {
			return "", false
		}
		key = strings.TrimPrefix(key, keyPrefix)
	}
	if key == "" {
		return "", false
	}
	p := strings.ReplaceAll(key, pathSepEncode, "/")
	if err := safepath.IsSafe(p); err != nil {
		return "", false
	}
	return p, true
}

func dataSize(data map[string]string) int {
	n := 0
	for k, v := range data {
		n += len(k) + len(v)
	}
	return n
}

func ensureUnderLimit(data map[string]string) error {
	if sz := dataSize(data); sz > MaxConfigMapBytes {
		return fmt.Errorf("configmap data would be %d bytes; max allowed is %d bytes", sz, MaxConfigMapBytes)
	}
	return nil
}

func parentDirs(filePath string) []string {
	filePath = strings.Trim(filePath, "/")
	dir := path.Dir(filePath)
	if dir == "." || dir == "/" || dir == "" {
		return nil
	}
	parts := strings.Split(dir, "/")
	out := make([]string, 0, len(parts))
	cur := ""
	for _, p := range parts {
		if cur == "" {
			cur = p
		} else {
			cur = cur + "/" + p
		}
		out = append(out, cur+"/")
	}
	return out
}
