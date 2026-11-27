package v1beta2

import (
	"encoding/json"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// RegisterSubresourceConversions registers both directions for every subresource and route body.
// TypeMeta is not converted: the serializer stamps the target apiVersion and kind.
func RegisterSubresourceConversions(s *runtime.Scheme) error {
	for _, register := range []func(*runtime.Scheme) error{
		addSubresourceConversion(Convert_v0alpha1_TestResults_To_v1beta2_TestResults),
		addSubresourceConversion(Convert_v1beta2_TestResults_To_v0alpha1_TestResults),
		addSubresourceConversion(Convert_v0alpha1_ResourceWrapper_To_v1beta2_ResourceWrapper),
		addSubresourceConversion(Convert_v1beta2_ResourceWrapper_To_v0alpha1_ResourceWrapper),
		addSubresourceConversion(Convert_v0alpha1_FileList_To_v1beta2_FileList),
		addSubresourceConversion(Convert_v1beta2_FileList_To_v0alpha1_FileList),
		addSubresourceConversion(Convert_v0alpha1_RefList_To_v1beta2_RefList),
		addSubresourceConversion(Convert_v1beta2_RefList_To_v0alpha1_RefList),
		addSubresourceConversion(Convert_v0alpha1_ResourceList_To_v1beta2_ResourceList),
		addSubresourceConversion(Convert_v1beta2_ResourceList_To_v0alpha1_ResourceList),
		addSubresourceConversion(Convert_v0alpha1_ResourceCountList_To_v1beta2_ResourceCountList),
		addSubresourceConversion(Convert_v1beta2_ResourceCountList_To_v0alpha1_ResourceCountList),
		addSubresourceConversion(Convert_v0alpha1_ResourceStats_To_v1beta2_ResourceStats),
		addSubresourceConversion(Convert_v1beta2_ResourceStats_To_v0alpha1_ResourceStats),
		addSubresourceConversion(Convert_v0alpha1_HistoryList_To_v1beta2_HistoryList),
		addSubresourceConversion(Convert_v1beta2_HistoryList_To_v0alpha1_HistoryList),
		addSubresourceConversion(Convert_v0alpha1_WebhookResponse_To_v1beta2_WebhookResponse),
		addSubresourceConversion(Convert_v1beta2_WebhookResponse_To_v0alpha1_WebhookResponse),
		addSubresourceConversion(Convert_v0alpha1_ExternalRepositoryList_To_v1beta2_ExternalRepositoryList),
		addSubresourceConversion(Convert_v1beta2_ExternalRepositoryList_To_v0alpha1_ExternalRepositoryList),
		addSubresourceConversion(Convert_v0alpha1_ConnectionAuthorizeRequest_To_v1beta2_ConnectionAuthorizeRequest),
		addSubresourceConversion(Convert_v1beta2_ConnectionAuthorizeRequest_To_v0alpha1_ConnectionAuthorizeRequest),
		addSubresourceConversion(Convert_v0alpha1_RepositoryViewList_To_v1beta2_RepositoryViewList),
		addSubresourceConversion(Convert_v1beta2_RepositoryViewList_To_v0alpha1_RepositoryViewList),
	} {
		if err := register(s); err != nil {
			return err
		}
	}
	return nil
}

func addSubresourceConversion[In, Out any](convert func(*In, *Out, conversion.Scope) error) func(*runtime.Scheme) error {
	return func(s *runtime.Scheme) error {
		return s.AddConversionFunc((*In)(nil), (*Out)(nil), func(a, b any, scope conversion.Scope) error {
			return convert(a.(*In), b.(*Out), scope)
		})
	}
}

func Convert_v0alpha1_TestResults_To_v1beta2_TestResults(in *v0alpha1.TestResults, out *TestResults, _ conversion.Scope) error {
	out.Code = in.Code
	out.Success = in.Success
	out.Errors = convertSubresourceSlice(in.Errors, func(e v0alpha1.ErrorDetails) RepositoryErrorDetails {
		return RepositoryErrorDetails{
			Type:     string(e.Type),
			Field:    subresourceNonZero(e.Field),
			Detail:   subresourceNonZero(e.Detail),
			Origin:   subresourceNonZero(e.Origin),
			BadValue: e.BadValue,
		}
	})
	return nil
}

func Convert_v1beta2_TestResults_To_v0alpha1_TestResults(in *TestResults, out *v0alpha1.TestResults, _ conversion.Scope) error {
	out.Code = in.Code
	out.Success = in.Success
	out.Errors = convertSubresourceSlice(in.Errors, func(e RepositoryErrorDetails) v0alpha1.ErrorDetails {
		return v0alpha1.ErrorDetails{
			Type:     metav1.CauseType(e.Type),
			Field:    subresourceValue(e.Field),
			Detail:   subresourceValue(e.Detail),
			Origin:   subresourceValue(e.Origin),
			BadValue: e.BadValue,
		}
	})
	return nil
}

func Convert_v0alpha1_ResourceWrapper_To_v1beta2_ResourceWrapper(in *v0alpha1.ResourceWrapper, out *ResourceWrapper, _ conversion.Scope) error {
	out.Path = in.Path
	out.Ref = in.Ref
	out.Hash = in.Hash
	out.Repository = ResourceRepositoryInfo{
		Type:      RepositorySpecType(in.Repository.Type),
		Title:     in.Repository.Title,
		Namespace: in.Repository.Namespace,
		Name:      in.Repository.Name,
	}
	if in.URLs != nil {
		urls := RepositoryURLs(*in.URLs)
		out.Urls = &urls
	} else {
		out.Urls = nil
	}
	out.Timestamp = in.Timestamp
	out.Resource = ResourceObjects{
		Type: ResourceType{
			Group:    in.Resource.Type.Group,
			Version:  in.Resource.Type.Version,
			Kind:     in.Resource.Type.Kind,
			Resource: in.Resource.Type.Resource,
			Classic:  ClassicFileType(in.Resource.Type.Classic),
		},
		File:     in.Resource.File,
		Existing: in.Resource.Existing,
		Action:   ResourceAction(in.Resource.Action),
		DryRun:   in.Resource.DryRun,
		Upsert:   in.Resource.Upsert,
	}
	out.Errors = in.Errors
	return nil
}

func Convert_v1beta2_ResourceWrapper_To_v0alpha1_ResourceWrapper(in *ResourceWrapper, out *v0alpha1.ResourceWrapper, _ conversion.Scope) error {
	out.Path = in.Path
	out.Ref = in.Ref
	out.Hash = in.Hash
	out.Repository = v0alpha1.ResourceRepositoryInfo{
		Type:      v0alpha1.RepositoryType(in.Repository.Type),
		Title:     in.Repository.Title,
		Namespace: in.Repository.Namespace,
		Name:      in.Repository.Name,
	}
	if in.Urls != nil {
		urls := v0alpha1.RepositoryURLs(*in.Urls)
		out.URLs = &urls
	} else {
		out.URLs = nil
	}
	out.Timestamp = in.Timestamp
	out.Resource = v0alpha1.ResourceObjects{
		Type: v0alpha1.ResourceType{
			Group:    in.Resource.Type.Group,
			Version:  in.Resource.Type.Version,
			Kind:     in.Resource.Type.Kind,
			Resource: in.Resource.Type.Resource,
			Classic:  v0alpha1.ClassicFileType(in.Resource.Type.Classic),
		},
		File:     in.Resource.File,
		Existing: in.Resource.Existing,
		Action:   v0alpha1.ResourceAction(in.Resource.Action),
		DryRun:   in.Resource.DryRun,
		Upsert:   in.Resource.Upsert,
	}
	out.Errors = in.Errors
	return nil
}

func Convert_v0alpha1_FileList_To_v1beta2_FileList(in *v0alpha1.FileList, out *FileList, _ conversion.Scope) error {
	out.ListMeta = in.ListMeta
	out.Items = convertSubresourceSlice(in.Items, func(i v0alpha1.FileItem) FileItem { return FileItem(i) })
	return nil
}

func Convert_v1beta2_FileList_To_v0alpha1_FileList(in *FileList, out *v0alpha1.FileList, _ conversion.Scope) error {
	out.ListMeta = in.ListMeta
	out.Items = convertSubresourceSlice(in.Items, func(i FileItem) v0alpha1.FileItem { return v0alpha1.FileItem(i) })
	return nil
}

func Convert_v0alpha1_RefList_To_v1beta2_RefList(in *v0alpha1.RefList, out *RefList, _ conversion.Scope) error {
	out.ListMeta = in.ListMeta
	out.Items = convertSubresourceSlice(in.Items, func(i v0alpha1.RefItem) RefItem { return RefItem(i) })
	return nil
}

func Convert_v1beta2_RefList_To_v0alpha1_RefList(in *RefList, out *v0alpha1.RefList, _ conversion.Scope) error {
	out.ListMeta = in.ListMeta
	out.Items = convertSubresourceSlice(in.Items, func(i RefItem) v0alpha1.RefItem { return v0alpha1.RefItem(i) })
	return nil
}

func Convert_v0alpha1_ResourceList_To_v1beta2_ResourceList(in *v0alpha1.ResourceList, out *ResourceList, _ conversion.Scope) error {
	out.ListMeta = in.ListMeta
	out.Items = convertSubresourceSlice(in.Items, func(i v0alpha1.ResourceListItem) ResourceListItem { return ResourceListItem(i) })
	return nil
}

func Convert_v1beta2_ResourceList_To_v0alpha1_ResourceList(in *ResourceList, out *v0alpha1.ResourceList, _ conversion.Scope) error {
	out.ListMeta = in.ListMeta
	out.Items = convertSubresourceSlice(in.Items, func(i ResourceListItem) v0alpha1.ResourceListItem { return v0alpha1.ResourceListItem(i) })
	return nil
}

func Convert_v0alpha1_ResourceCountList_To_v1beta2_ResourceCountList(in *v0alpha1.ResourceCountList, out *ResourceCountList, _ conversion.Scope) error {
	out.ListMeta = in.ListMeta
	out.Items = convertResourceCountsToV1beta2(in.Items)
	return nil
}

func Convert_v1beta2_ResourceCountList_To_v0alpha1_ResourceCountList(in *ResourceCountList, out *v0alpha1.ResourceCountList, _ conversion.Scope) error {
	out.ListMeta = in.ListMeta
	out.Items = convertResourceCountsToV0alpha1(in.Items)
	return nil
}

func Convert_v0alpha1_ResourceStats_To_v1beta2_ResourceStats(in *v0alpha1.ResourceStats, out *ResourceStats, _ conversion.Scope) error {
	out.ListMeta = in.ListMeta
	out.Instance = convertResourceCountsToV1beta2(in.Instance)
	out.Unmanaged = convertResourceCountsToV1beta2(in.Unmanaged)
	out.Managed = convertSubresourceSlice(in.Managed, func(m v0alpha1.ManagerStats) ManagerStats {
		return ManagerStats{Kind: m.Kind, Id: m.Identity, Stats: convertResourceCountsToV1beta2(m.Stats)}
	})
	return nil
}

func Convert_v1beta2_ResourceStats_To_v0alpha1_ResourceStats(in *ResourceStats, out *v0alpha1.ResourceStats, _ conversion.Scope) error {
	out.ListMeta = in.ListMeta
	out.Instance = convertResourceCountsToV0alpha1(in.Instance)
	out.Unmanaged = convertResourceCountsToV0alpha1(in.Unmanaged)
	out.Managed = convertSubresourceSlice(in.Managed, func(m ManagerStats) v0alpha1.ManagerStats {
		return v0alpha1.ManagerStats{Kind: m.Kind, Identity: m.Id, Stats: convertResourceCountsToV0alpha1(m.Stats)}
	})
	return nil
}

func Convert_v0alpha1_HistoryList_To_v1beta2_HistoryList(in *v0alpha1.HistoryList, out *HistoryList, _ conversion.Scope) error {
	out.ListMeta = in.ListMeta
	out.Items = convertSubresourceSlice(in.Items, func(i v0alpha1.HistoryItem) HistoryItem {
		return HistoryItem{
			Ref:       i.Ref,
			Message:   i.Message,
			Authors:   convertSubresourceSlice(i.Authors, func(a v0alpha1.Author) Author { return Author(a) }),
			CreatedAt: i.CreatedAt,
		}
	})
	return nil
}

func Convert_v1beta2_HistoryList_To_v0alpha1_HistoryList(in *HistoryList, out *v0alpha1.HistoryList, _ conversion.Scope) error {
	out.ListMeta = in.ListMeta
	out.Items = convertSubresourceSlice(in.Items, func(i HistoryItem) v0alpha1.HistoryItem {
		return v0alpha1.HistoryItem{
			Ref:       i.Ref,
			Message:   i.Message,
			Authors:   convertSubresourceSlice(i.Authors, func(a Author) v0alpha1.Author { return v0alpha1.Author(a) }),
			CreatedAt: i.CreatedAt,
		}
	})
	return nil
}

func Convert_v0alpha1_WebhookResponse_To_v1beta2_WebhookResponse(in *v0alpha1.WebhookResponse, out *WebhookResponse, _ conversion.Scope) error {
	out.Code = in.Code
	out.Added = in.Message
	return convertSubresourceViaJSON(in.Job, &out.Job)
}

func Convert_v1beta2_WebhookResponse_To_v0alpha1_WebhookResponse(in *WebhookResponse, out *v0alpha1.WebhookResponse, _ conversion.Scope) error {
	out.Code = in.Code
	out.Message = in.Added
	return convertSubresourceViaJSON(in.Job, &out.Job)
}

func Convert_v0alpha1_ExternalRepositoryList_To_v1beta2_ExternalRepositoryList(in *v0alpha1.ExternalRepositoryList, out *ExternalRepositoryList, _ conversion.Scope) error {
	out.ListMeta = in.ListMeta
	out.Items = convertSubresourceSlice(in.Items, func(r v0alpha1.ExternalRepository) ExternalRepository {
		return ExternalRepository{Name: r.Name, Owner: r.Owner, Url: r.URL}
	})
	return nil
}

func Convert_v1beta2_ExternalRepositoryList_To_v0alpha1_ExternalRepositoryList(in *ExternalRepositoryList, out *v0alpha1.ExternalRepositoryList, _ conversion.Scope) error {
	out.ListMeta = in.ListMeta
	out.Items = convertSubresourceSlice(in.Items, func(r ExternalRepository) v0alpha1.ExternalRepository {
		return v0alpha1.ExternalRepository{Name: r.Name, Owner: r.Owner, URL: r.Url}
	})
	return nil
}

func Convert_v0alpha1_ConnectionAuthorizeRequest_To_v1beta2_ConnectionAuthorizeRequest(in *v0alpha1.ConnectionAuthorizeRequest, out *ConnectionAuthorizeRequest, _ conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.Spec = ConnectionAuthorizeRequestSpec(in.Spec)
	out.Status = ConnectionAuthorizeRequestStatus(in.Status)
	return nil
}

func Convert_v1beta2_ConnectionAuthorizeRequest_To_v0alpha1_ConnectionAuthorizeRequest(in *ConnectionAuthorizeRequest, out *v0alpha1.ConnectionAuthorizeRequest, _ conversion.Scope) error {
	out.ObjectMeta = in.ObjectMeta
	out.Spec = v0alpha1.ConnectionAuthorizeRequestSpec(in.Spec)
	out.Status = v0alpha1.ConnectionAuthorizeRequestStatus(in.Status)
	return nil
}

func Convert_v0alpha1_RepositoryViewList_To_v1beta2_RepositoryViewList(in *v0alpha1.RepositoryViewList, out *RepositoryViewList, _ conversion.Scope) error {
	out.AllowedTargets = convertSubresourceSlice(in.AllowedTargets, func(t v0alpha1.SyncTargetType) RepositorySyncOptionsTarget {
		return RepositorySyncOptionsTarget(t)
	})
	out.AllowImageRendering = in.AllowImageRendering
	out.MaxRepositories = in.MaxRepositories
	out.AvailableRepositoryTypes = convertSubresourceSlice(in.AvailableRepositoryTypes, func(t v0alpha1.RepositoryType) RepositorySpecType {
		return RepositorySpecType(t)
	})
	out.AvailableConnectionTypes = convertSubresourceSlice(in.AvailableConnectionTypes, func(t v0alpha1.ConnectionType) ConnectionType {
		return ConnectionType(t)
	})
	out.AvailableResources = convertSubresourceSlice(in.AvailableResources, func(r v0alpha1.SupportedResource) SupportedResource {
		return SupportedResource(r)
	})
	out.Items = nil
	if in.Items != nil {
		out.Items = make([]RepositoryView, len(in.Items))
	}
	for i, v := range in.Items {
		view := &out.Items[i]
		view.Name = v.Name
		view.Title = v.Title
		view.Type = RepositorySpecType(v.Type)
		view.Target = RepositorySyncOptionsTarget(v.Target)
		view.Branch = v.Branch
		view.Url = v.URL
		view.Path = v.Path
		view.Workflows = convertSubresourceSlice(v.Workflows, func(w v0alpha1.Workflow) RepositorySpecWorkflows {
			return RepositorySpecWorkflows(w)
		})
		if err := convertSubresourceViaJSON(v.Commit, &view.Commit); err != nil {
			return err
		}
		if err := convertSubresourceViaJSON(v.BranchOptions, &view.BranchOptions); err != nil {
			return err
		}
		if err := convertSubresourceViaJSON(v.PullRequest, &view.PullRequest); err != nil {
			return err
		}
	}
	return nil
}

func Convert_v1beta2_RepositoryViewList_To_v0alpha1_RepositoryViewList(in *RepositoryViewList, out *v0alpha1.RepositoryViewList, _ conversion.Scope) error {
	out.AllowedTargets = convertSubresourceSlice(in.AllowedTargets, func(t RepositorySyncOptionsTarget) v0alpha1.SyncTargetType {
		return v0alpha1.SyncTargetType(t)
	})
	out.AllowImageRendering = in.AllowImageRendering
	out.MaxRepositories = in.MaxRepositories
	out.AvailableRepositoryTypes = convertSubresourceSlice(in.AvailableRepositoryTypes, func(t RepositorySpecType) v0alpha1.RepositoryType {
		return v0alpha1.RepositoryType(t)
	})
	out.AvailableConnectionTypes = convertSubresourceSlice(in.AvailableConnectionTypes, func(t ConnectionType) v0alpha1.ConnectionType {
		return v0alpha1.ConnectionType(t)
	})
	out.AvailableResources = convertSubresourceSlice(in.AvailableResources, func(r SupportedResource) v0alpha1.SupportedResource {
		return v0alpha1.SupportedResource(r)
	})
	out.Items = nil
	if in.Items != nil {
		out.Items = make([]v0alpha1.RepositoryView, len(in.Items))
	}
	for i, v := range in.Items {
		view := &out.Items[i]
		view.Name = v.Name
		view.Title = v.Title
		view.Type = v0alpha1.RepositoryType(v.Type)
		view.Target = v0alpha1.SyncTargetType(v.Target)
		view.Branch = v.Branch
		view.URL = v.Url
		view.Path = v.Path
		view.Workflows = convertSubresourceSlice(v.Workflows, func(w RepositorySpecWorkflows) v0alpha1.Workflow {
			return v0alpha1.Workflow(w)
		})
		if err := convertSubresourceViaJSON(v.Commit, &view.Commit); err != nil {
			return err
		}
		if err := convertSubresourceViaJSON(v.BranchOptions, &view.BranchOptions); err != nil {
			return err
		}
		if err := convertSubresourceViaJSON(v.PullRequest, &view.PullRequest); err != nil {
			return err
		}
	}
	return nil
}

func convertResourceCountsToV1beta2(in []v0alpha1.ResourceCount) []ResourceCount {
	return convertSubresourceSlice(in, func(c v0alpha1.ResourceCount) ResourceCount { return ResourceCount(c) })
}

func convertResourceCountsToV0alpha1(in []ResourceCount) []v0alpha1.ResourceCount {
	return convertSubresourceSlice(in, func(c ResourceCount) v0alpha1.ResourceCount { return v0alpha1.ResourceCount(c) })
}

// convertSubresourceSlice keeps nil and empty slices apart, so both survive a round trip.
func convertSubresourceSlice[In, Out any](in []In, convert func(In) Out) []Out {
	if in == nil {
		return nil
	}
	out := make([]Out, len(in))
	for i, v := range in {
		out[i] = convert(v)
	}
	return out
}

// convertSubresourceViaJSON converts the kind types embedded in subresource bodies (JobSpec and the
// repository commit, branch and pull request options). Their JSON is identical in both versions, and
// their typed converters belong to the Repository and Job conversion files.
func convertSubresourceViaJSON[In, Out any](in *In, out **Out) error {
	if in == nil {
		*out = nil
		return nil
	}
	data, err := json.Marshal(in)
	if err != nil {
		return fmt.Errorf("encode %T: %w", in, err)
	}
	converted := new(Out)
	if err := json.Unmarshal(data, converted); err != nil {
		return fmt.Errorf("decode %T: %w", converted, err)
	}
	*out = converted
	return nil
}

func subresourceNonZero[T comparable](v T) *T {
	var zero T
	if v == zero {
		return nil
	}
	return &v
}

func subresourceValue[T any](p *T) T {
	if p == nil {
		var zero T
		return zero
	}
	return *p
}
