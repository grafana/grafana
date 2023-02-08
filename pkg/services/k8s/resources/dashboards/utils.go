package dashboards

import (
	"context"
	"crypto/sha256"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/util"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/dynamic"
)

// This makes an consistent mapping between Grafana UIDs and k8s compatible names
func GrafanaUIDToK8sName(uid string) string {
	h := sha256.New()
	_, _ = h.Write([]byte(uid))
	bs := h.Sum(nil)
	return fmt.Sprintf("g%x", bs[:12])
}

// FIXME this shouldnt need to exist. use a uuidv4 and do some sort of mapping
// generate a unique id in k8s
func getUnusedGrafanaUID(ctx context.Context, resourceClient dynamic.ResourceInterface) (string, error) {
	var err error
	isInUse := false
	for i := 0; i < 3; i++ {
		uid := util.GenerateShortUID()
		name := GrafanaUIDToK8sName(uid)
		isInUse, err = isK8sNameInUse(ctx, resourceClient, name)
		if err == nil && !isInUse {
			return uid, nil
		}
	}
	return "", fmt.Errorf("unable to find unique grafana UID: %w", err)
}

// Gets resource version tells us whether there was an error or not found
func getResourceVersion(ctx context.Context, resourceClient dynamic.ResourceInterface, uid string) (string, bool, error) {
	name := GrafanaUIDToK8sName(uid)
	r, err := resourceClient.Get(ctx, name, metav1.GetOptions{})
	if err == nil {
		return r.GetResourceVersion(), true, nil
	}

	if err != nil && strings.Contains(err.Error(), "not found") {
		return "", true, nil
	}

	return "", false, err
}

// tells us whether uid exists in k8s
func isK8sNameInUse(ctx context.Context, resourceClient dynamic.ResourceInterface, name string) (bool, error) {
	_, err := resourceClient.Get(ctx, name, metav1.GetOptions{})
	if err == nil {
		return true, nil
	}

	if err != nil && strings.Contains(err.Error(), "not found") {
		return false, nil
	}

	return false, err
}
