package export

import (
	"context"
	"errors"
	"fmt"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	grafanautil "github.com/grafana/grafana/pkg/util"
)

// FIXME: This is used to make sure we save dashboards in the apiVersion they were original saved in
// When requesting v0 or v2 dashboards over the v1 api -- the backend tries (and fails!) to convert values
// The response status indicates the original stored version, so we can then request it in an un-converted form
type conversionShim = func(ctx context.Context, item *unstructured.Unstructured) (*unstructured.Unstructured, error)

func ExportResources(ctx context.Context, options provisioning.ExportJobOptions, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder, generateNewUIDs bool) error {
	progress.SetMessage(ctx, "start resource export")
	for _, kind := range resources.SupportedProvisioningResources {
		// skip from folders as we do them first... so only dashboards
		if kind == resources.FolderResource {
			continue
		}

		progress.SetMessage(ctx, fmt.Sprintf("export %s", kind.Resource))
		client, _, err := clients.ForResource(ctx, kind)
		if err != nil {
			return fmt.Errorf("get client for %s: %w", kind.Resource, err)
		}

		// When requesting dashboards over the v1 api, we want to keep the original apiVersion if conversion fails
		var shim conversionShim
		if kind.GroupResource() == resources.DashboardResource.GroupResource() {
			shim = newDashboardConversionShim(kind, clients)
		}

		if err := exportResource(ctx, options, client, shim, repositoryResources, progress, generateNewUIDs); err != nil {
			return fmt.Errorf("export %s: %w", kind.Resource, err)
		}
	}

	return nil
}

// ExportSpecificResources exports the explicit list of resources named in
// options.Resources. It shares the per-item write path with ExportResources
// (manager-identity skip, conversion shim, UID regeneration) but resolves
// items via Get rather than listing the namespace.
//
// The admission validator restricts Resources to unmanaged Dashboards; this
// function trusts that constraint and short-circuits anything else with a
// recorded warning so a misconfigured caller surfaces in the job summary
// rather than silently failing.
func ExportSpecificResources(ctx context.Context, options provisioning.ExportJobOptions, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder, generateNewUIDs bool) error {
	progress.SetMessage(ctx, "start selective resource export")

	// ForKind resolves the preferred version when Version is empty.
	dashboardGVK := schema.GroupVersionKind{
		Group: resources.DashboardKind.Group,
		Kind:  resources.DashboardKind.Kind,
	}
	dashClient, dashGVR, err := clients.ForKind(ctx, dashboardGVK)
	if err != nil {
		return fmt.Errorf("get dashboard client: %w", err)
	}
	shim := newDashboardConversionShim(dashGVR, clients)

	for _, ref := range options.Resources {
		result := jobs.NewGroupKindResult(ref.Name, resources.DashboardKind.Group, resources.DashboardKind.Kind).
			WithAction(repository.FileActionIgnored)

		if ref.Kind != "" && ref.Kind != resources.DashboardKind.Kind {
			result.WithWarning(fmt.Errorf("resource %s/%s is not a %s", ref.Kind, ref.Name, resources.DashboardKind.Kind))
			progress.Record(ctx, result.Build())
			if err := progress.TooManyErrors(); err != nil {
				return err
			}
			continue
		}

		item, err := dashClient.Get(ctx, ref.Name, metav1.GetOptions{})
		if err != nil {
			if apierrors.IsNotFound(err) {
				result.WithWarning(fmt.Errorf("dashboard %q not found", ref.Name))
			} else {
				result.WithError(fmt.Errorf("get dashboard %q: %w", ref.Name, err))
			}
			progress.Record(ctx, result.Build())
			if err := progress.TooManyErrors(); err != nil {
				return err
			}
			continue
		}

		if err := exportItem(ctx, item, options, shim, repositoryResources, progress, generateNewUIDs, true); err != nil {
			return err
		}
	}

	return nil
}

func exportResource(ctx context.Context,
	options provisioning.ExportJobOptions,
	client dynamic.ResourceInterface,
	shim conversionShim,
	repositoryResources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
	generateNewUIDs bool,
) error {
	// FIXME: using k8s list will force evrything into one version -- we really want the original saved version
	// this will work well enough for now, but needs to be revisted as we have a bigger mix of active versions
	return resources.ForEach(ctx, client, func(item *unstructured.Unstructured) error {
		return exportItem(ctx, item, options, shim, repositoryResources, progress, generateNewUIDs, false)
	})
}

// exportItem writes a single resource to the repository, applying the shared
// ignore/shim/UID-regen rules. When explicitlyRequested is true, a skipped
// managed resource produces a warning so the caller sees why the dashboard
// they named was not exported; the bulk path keeps the quiet ignore since
// encountering managed resources is expected when iterating the whole namespace.
func exportItem(ctx context.Context,
	item *unstructured.Unstructured,
	options provisioning.ExportJobOptions,
	shim conversionShim,
	repositoryResources resources.RepositoryResources,
	progress jobs.JobProgressRecorder,
	generateNewUIDs bool,
	explicitlyRequested bool,
) error {
	gvk := item.GroupVersionKind()
	name := item.GetName()
	resultBuilder := jobs.NewGVKResult(name, gvk).WithAction(repository.FileActionCreated)

	meta, err := utils.MetaAccessor(item)
	if err != nil {
		metaError := fmt.Errorf("extracting meta accessor for resource %s: %w", name, err)
		resultBuilder.WithAction(repository.FileActionIgnored).WithError(metaError)
		progress.Record(ctx, resultBuilder.Build())
		return nil
	}

	manager, _ := meta.GetManagerProperties()
	if manager.Identity != "" {
		resultBuilder.WithAction(repository.FileActionIgnored)
		if explicitlyRequested {
			resultBuilder.WithWarning(fmt.Errorf("dashboard %q is managed by %q and was not exported", name, manager.Identity))
		}
		progress.Record(ctx, resultBuilder.Build())
		return nil
	}

	if shim != nil {
		item, err = shim(ctx, item)
	}

	if err == nil && generateNewUIDs {
		item = item.DeepCopy()
		item.SetName(grafanautil.GenerateShortUID())
	}

	if err == nil {
		var path string
		path, err = repositoryResources.WriteResourceFileFromObject(ctx, item, resources.WriteOptions{
			Path: options.Path,
			Ref:  options.Branch,
		})
		resultBuilder.WithPath(path)
	}

	if errors.Is(err, resources.ErrAlreadyInRepository) {
		resultBuilder.WithAction(repository.FileActionIgnored)
	} else if err != nil {
		resultBuilder.WithAction(repository.FileActionIgnored).
			WithError(fmt.Errorf("writing resource file for %s: %w", name, err))
	}

	progress.Record(ctx, resultBuilder.Build())
	return progress.TooManyErrors()
}

// newDashboardConversionShim returns a conversionShim that preserves each
// dashboard's original apiVersion when the default v1 response has
// lossy-converted fields. For v0 the stored model is simply restored via
// apiVersion rewrite; for other stored versions we re-Get through a cached
// dynamic client keyed on the version string.
func newDashboardConversionShim(gvr schema.GroupVersionResource, clients resources.ResourceClients) conversionShim {
	versionClients := make(map[string]dynamic.ResourceInterface)
	return func(ctx context.Context, item *unstructured.Unstructured) (*unstructured.Unstructured, error) {
		// Check if there's a stored version in the conversion status.
		// This indicates the original API version the dashboard was created with,
		// which should be preserved during export regardless of whether conversion succeeded or failed.
		storedVersion, _, _ := unstructured.NestedString(item.Object, "status", "conversion", "storedVersion")
		if storedVersion != "" {
			// For v0 we can simply fallback -- the full model is saved
			if strings.HasPrefix(storedVersion, "v0") {
				item.SetAPIVersion(fmt.Sprintf("%s/%s", gvr.Group, storedVersion))
				return item, nil
			}

			// For any other version (v1, v2, v3, etc.), fetch the original version via client
			versionClient, ok := versionClients[storedVersion]
			if !ok {
				versionGVR := schema.GroupVersionResource{
					Group:    gvr.Group,
					Version:  storedVersion,
					Resource: gvr.Resource,
				}
				var err error
				versionClient, _, err = clients.ForResource(ctx, versionGVR)
				if err != nil {
					return nil, fmt.Errorf("get client for version %s: %w", storedVersion, err)
				}
				versionClients[storedVersion] = versionClient
			}
			return versionClient.Get(ctx, item.GetName(), metav1.GetOptions{})
		}

		// If conversion failed but there's no storedVersion, this is an error condition
		failed, _, _ := unstructured.NestedBool(item.Object, "status", "conversion", "failed")
		if failed {
			return nil, fmt.Errorf("conversion failed but no storedVersion available")
		}

		return item, nil
	}
}
