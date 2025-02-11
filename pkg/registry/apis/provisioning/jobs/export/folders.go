package export

import (
	"fmt"

	"golang.org/x/net/context"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"

	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/k8sctx"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

func readFolders(ctx context.Context, client dynamic.ResourceInterface, skip string) (*resources.FolderTree, error) {
	ctx, cancel, err := k8sctx.Fork(ctx)
	if err != nil {
		return nil, err
	}
	defer cancel()

	// TODO: handle pagination
	rawList, err := client.List(ctx, metav1.ListOptions{Limit: 10000})
	if err != nil {
		return nil, fmt.Errorf("failed to list folders: %w", err)
	}
	if rawList.GetContinue() != "" {
		return nil, fmt.Errorf("unable to list all folders in one request: %s", rawList.GetContinue())
	}

	// filter out the folders we already own
	rawFolders := make([]unstructured.Unstructured, 0, len(rawList.Items))
	for _, f := range rawList.Items {
		repoName := f.GetAnnotations()[apiutils.AnnoKeyRepoName]
		if repoName == skip {
			logger.Info("skip as folder is already in repository", "folder", f.GetName())
			continue
		}

		rawFolders = append(rawFolders, f)
	}

	return resources.NewFolderTreeFromUnstructure(ctx, rawFolders), nil
}
