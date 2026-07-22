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
	for _, supported := range clients.SupportedResources() {
		// skip folders as we do them first... so only non-folder kinds here
		if supported.GroupKind == resources.FolderKind.GroupKind() {
			continue
		}

		// Resolve the preferred version + plural resource via discovery.
		client, gvr, err := clients.ForKind(ctx, schema.GroupVersionKind{Group: supported.Group, Kind: supported.Kind})
		if err != nil {
			return fmt.Errorf("get client for %s: %w", supported.Kind, err)
		}

		progress.SetMessage(ctx, fmt.Sprintf("export %s", gvr.Resource))

		// When requesting dashboards over the v1 api, we want to keep the original apiVersion if conversion fails
		var shim conversionShim
		if gvr.GroupResource() == resources.DashboardResource.GroupResource() {
			shim = newDashboardConversionShim(gvr, clients)
		}

		if err := exportResource(ctx, options, client, shim, repositoryResources, progress, generateNewUIDs); err != nil {
			return fmt.Errorf("export %s: %w", gvr.Resource, err)
		}
	}

	return nil
}

// ExportSpecificResources exports the explicit list of resources named in
// options.Resources. It shares the per-item write path with ExportResources
// (manager-identity skip, conversion shim, UID regeneration) but resolves
// items via Get rather than listing the namespace.
//
// Each reference is resolved against its own kind/group via discovery, so any
// kind the admission validator accepts can be selectively exported. The
// dashboard conversion shim is applied only to dashboards; other kinds are
// written as returned. A reference whose kind cannot be resolved is recorded as
// a failed item so a misconfigured caller surfaces in the job summary rather
// than silently failing.
//
// Unlike the full export, this does not write the entire instance folder tree.
// Only the folders the requested resources need are exported: an explicitly
// named folder, and the parent-folder ancestry of every requested resource.
// A resource whose folder was not named still lands at its nested path because
// that folder (and its ancestors) is generated on demand from the folder API.
func ExportSpecificResources(ctx context.Context, options provisioning.ExportJobOptions, folderClient dynamic.ResourceInterface, clients resources.ResourceClients, repositoryResources resources.RepositoryResources, progress jobs.JobProgressRecorder, generateNewUIDs bool) error {
	progress.SetMessage(ctx, "start selective resource export")

	// resolvedKind caches the per-kind client and (for dashboards only) the
	// conversion shim, so repeated references to the same kind don't re-run
	// discovery.
	type resolvedKind struct {
		client dynamic.ResourceInterface
		gvr    schema.GroupVersionResource
		shim   conversionShim
	}
	resolved := make(map[schema.GroupVersionKind]resolvedKind)

	// pendingResource pairs a fetched, non-folder resource with the shim needed
	// to write it. Resources are written only after their folder ancestry has
	// been exported so each one resolves to its correct nested path.
	type pendingResource struct {
		item *unstructured.Unstructured
		shim conversionShim
	}
	var pending []pendingResource

	// folderUIDs accumulates every folder whose ancestry must be written:
	// explicitly named folders plus the parent folder of each requested
	// resource. Duplicates are harmless; collectFolderAncestry de-duplicates.
	var folderUIDs []string

	for _, ref := range options.Resources {
		// ForKind resolves the preferred version when Version is empty.
		gvk := schema.GroupVersionKind{Group: ref.Group, Kind: ref.Kind}

		// Leave the action unset on the error paths below: the recorder treats
		// FileActionIgnored results as non-fatal, and we want the caller's
		// bad/unresolvable reference to escalate the job state.
		result := jobs.NewGroupKindResult(ref.Name, ref.Group, ref.Kind)

		rk, ok := resolved[gvk]
		if !ok {
			client, gvr, err := clients.ForKind(ctx, gvk)
			if err != nil {
				result.WithError(fmt.Errorf("resolve client for kind %q: %w", kindLabel(ref.Kind), err))
				progress.Record(ctx, result.Build())
				if err := progress.TooManyErrors(); err != nil {
					return err
				}
				continue
			}

			rk = resolvedKind{client: client, gvr: gvr}
			// Dashboards may need their original apiVersion preserved on export.
			if gvr.GroupResource() == resources.DashboardResource.GroupResource() {
				rk.shim = newDashboardConversionShim(gvr, clients)
			}
			resolved[gvk] = rk
		}

		// An explicitly named folder is exported as part of the folder tree
		// (with its ancestry) rather than as a standalone resource file.
		if rk.gvr.GroupResource() == resources.FolderResource.GroupResource() {
			folderUIDs = append(folderUIDs, ref.Name)
			continue
		}

		item, err := rk.client.Get(ctx, ref.Name, metav1.GetOptions{})
		if err != nil {
			if apierrors.IsNotFound(err) {
				result.WithError(fmt.Errorf("%s %q not found", kindLabel(ref.Kind), ref.Name))
			} else {
				result.WithError(fmt.Errorf("get %s %q: %w", kindLabel(ref.Kind), ref.Name, err))
			}
			progress.Record(ctx, result.Build())
			if err := progress.TooManyErrors(); err != nil {
				return err
			}
			continue
		}

		// Record the parent folder so its ancestry is exported before the
		// resource is written. Meta extraction failures are surfaced by
		// exportItem when the resource is written below.
		if meta, err := utils.MetaAccessor(item); err == nil {
			if folder := meta.GetFolder(); folder != "" {
				folderUIDs = append(folderUIDs, folder)
			}
		}
		pending = append(pending, pendingResource{item: item, shim: rk.shim})
	}

	if err := exportFolderAncestry(ctx, options, folderClient, repositoryResources, progress, folderUIDs); err != nil {
		return err
	}

	for _, p := range pending {
		if err := exportItem(ctx, p.item, options, p.shim, repositoryResources, progress, generateNewUIDs, true); err != nil {
			return err
		}
	}

	return nil
}

// kindLabel returns a human-readable label for a resource kind, falling back to
// a generic noun when the kind is unset so user-facing messages still read
// correctly.
func kindLabel(kind string) string {
	if kind == "" {
		return "resource"
	}
	return kind
}

// sloAppResourcePrefix identifies dashboards and folders generated by the
// Grafana SLO app. These are derived artifacts (the SLO definition is the
// source of truth) whose names contain underscores that are invalid resource
// names on sync-back, so they must never be exported to a repository. This is a
// stopgap keyed on the name until the SLO app stamps a manager kind that the
// standard managed-resource skip can filter on instead.
const sloAppResourcePrefix = "grafana_slo_app-"

// isAppGeneratedResource reports whether name belongs to a resource generated by
// another Grafana app that must be excluded from export.
// Only the SLO app is recognised today.
func isAppGeneratedResource(name string) bool {
	return strings.HasPrefix(name, sloAppResourcePrefix)
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
// ignore/shim/UID-regen rules. When explicitlyRequested is true, a managed
// resource produces an error: the caller named a resource that cannot be
// exported, so the job should surface that failure rather than silently
// dropping it. The bulk path keeps the quiet ignore since encountering
// managed resources is expected when iterating the whole namespace.
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

	// Derive a human name from the item's kind so user-facing messages read
	// correctly for any exported resource, not just dashboards.
	kindName := kindLabel(gvk.Kind)

	// App-generated resources (e.g. SLO-app dashboards) are derived artifacts
	// with underscore names that are invalid on sync-back; skip them like
	// managed resources. Mirror the managed-resource behaviour: quietly ignore
	// on the bulk path, but fail an explicit request so a caller that named an
	// unexportable resource sees it in the job summary.
	if isAppGeneratedResource(name) {
		if explicitlyRequested {
			resultBuilder.WithError(fmt.Errorf("%s %q is generated by another app and cannot be exported", kindName, name))
			progress.Record(ctx, resultBuilder.Build())
			return progress.TooManyErrors()
		}
		resultBuilder.WithAction(repository.FileActionIgnored)
		progress.Record(ctx, resultBuilder.Build())
		return nil
	}

	meta, err := utils.MetaAccessor(item)
	if err != nil {
		metaError := fmt.Errorf("extracting meta accessor for resource %s: %w", name, err)
		// Keep the default (created) action so the failure is counted rather
		// than silently discarded as an ignored result.
		resultBuilder.WithError(metaError)
		progress.Record(ctx, resultBuilder.Build())
		return progress.TooManyErrors()
	}

	manager, managed := meta.GetManagerProperties()
	if managed {
		if explicitlyRequested {
			// Leave the default action in place: the recorder discards errors
			// on FileActionIgnored results, and we want this failure to count.
			resultBuilder.WithError(fmt.Errorf("%s %q is managed by %q and cannot be exported", kindName, name, manager.Kind))
			progress.Record(ctx, resultBuilder.Build())
			return progress.TooManyErrors()
		}
		resultBuilder.WithAction(repository.FileActionIgnored)
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
		// Keep the default (created) action so the error is counted: recording a
		// genuine write failure as FileActionIgnored would let the recorder
		// discard the error and pass the export off as successful.
		resultBuilder.WithError(fmt.Errorf("writing resource file for %s: %w", name, err))
	}

	progress.Record(ctx, resultBuilder.Build())
	return progress.TooManyErrors()
}

// newDashboardConversionShim returns a conversionShim that keeps each exported
// dashboard's body and apiVersion consistent. The export lists dashboards at the
// preferred version, which lossily converts any dashboard stored at a different
// version, so we re-Get the un-converted object through a dynamic client pinned
// to the stored version. v0 is the exception: a file labeled v0alpha1 cannot be
// loaded by the frontend dashboard loader (nor the provisioning preview path)
// once it is synced back, so v0 dashboards are fetched (losslessly) as v1.
func newDashboardConversionShim(gvr schema.GroupVersionResource, clients resources.ResourceClients) conversionShim {
	versionClients := make(map[string]dynamic.ResourceInterface)
	return func(ctx context.Context, item *unstructured.Unstructured) (*unstructured.Unstructured, error) {
		// Check if there's a stored version in the conversion status.
		// This indicates the original API version the dashboard was created with.
		storedVersion, _, _ := unstructured.NestedString(item.Object, "status", "conversion", "storedVersion")
		if storedVersion != "" {
			// Fetch the un-converted object at its stored version. v0 is exported as
			// v1 instead: a v0alpha1-labeled file cannot be loaded once synced back,
			// and v0 maps to v1 losslessly.
			fetchVersion := storedVersion
			if strings.HasPrefix(storedVersion, "v0") {
				fetchVersion = resources.DashboardResource.Version
			}

			versionClient, ok := versionClients[fetchVersion]
			if !ok {
				versionGVR := schema.GroupVersionResource{
					Group:    gvr.Group,
					Version:  fetchVersion,
					Resource: gvr.Resource,
				}
				var err error
				versionClient, _, err = clients.ForResource(ctx, versionGVR)
				if err != nil {
					return nil, fmt.Errorf("get client for version %s: %w", fetchVersion, err)
				}
				versionClients[fetchVersion] = versionClient
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
