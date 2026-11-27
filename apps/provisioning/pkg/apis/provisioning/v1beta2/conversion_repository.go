package v1beta2

import (
	"fmt"
	"slices"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// Keys accepted in Repository.Secure. They match the JSON names of v0alpha1.SecureValues.
const (
	RepositorySecureToken            = "token"
	RepositorySecureWebhookSecret    = "webhookSecret"
	RepositorySecureCommitSigningKey = "commitSigningKey"
)

// RepositorySecureKeys lists every key accepted in Repository.Secure.
var RepositorySecureKeys = []string{RepositorySecureToken, RepositorySecureWebhookSecret, RepositorySecureCommitSigningKey}

// RegisterRepositoryConversions registers the Repository and RepositoryList conversions
// between v0alpha1 and v1beta2 in both directions.
func RegisterRepositoryConversions(s *runtime.Scheme) error {
	if err := s.AddConversionFunc((*v0alpha1.Repository)(nil), (*Repository)(nil), func(a, b any, scope conversion.Scope) error {
		return Convert_v0alpha1_Repository_To_v1beta2_Repository(a.(*v0alpha1.Repository), b.(*Repository), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*Repository)(nil), (*v0alpha1.Repository)(nil), func(a, b any, scope conversion.Scope) error {
		return Convert_v1beta2_Repository_To_v0alpha1_Repository(a.(*Repository), b.(*v0alpha1.Repository), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*v0alpha1.RepositoryList)(nil), (*RepositoryList)(nil), func(a, b any, scope conversion.Scope) error {
		return Convert_v0alpha1_RepositoryList_To_v1beta2_RepositoryList(a.(*v0alpha1.RepositoryList), b.(*RepositoryList), scope)
	}); err != nil {
		return err
	}
	return s.AddConversionFunc((*RepositoryList)(nil), (*v0alpha1.RepositoryList)(nil), func(a, b any, scope conversion.Scope) error {
		return Convert_v1beta2_RepositoryList_To_v0alpha1_RepositoryList(a.(*RepositoryList), b.(*v0alpha1.RepositoryList), scope)
	})
}

// Convert_v0alpha1_Repository_To_v1beta2_Repository leaves TypeMeta to the caller, like generated
// Kubernetes conversions: the scheme sets it when converting to a version.
func Convert_v0alpha1_Repository_To_v1beta2_Repository(in *v0alpha1.Repository, out *Repository, s conversion.Scope) error {
	in.ObjectMeta.DeepCopyInto(&out.ObjectMeta)
	if err := Convert_v0alpha1_RepositorySpec_To_v1beta2_RepositorySpec(&in.Spec, &out.Spec, s); err != nil {
		return err
	}
	out.Secure = repositorySecureFromV0alpha1(in.Secure)
	return Convert_v0alpha1_RepositoryStatus_To_v1beta2_RepositoryStatus(&in.Status, &out.Status, s)
}

// Convert_v1beta2_Repository_To_v0alpha1_Repository leaves TypeMeta to the caller, like generated
// Kubernetes conversions: the scheme sets it when converting to a version.
func Convert_v1beta2_Repository_To_v0alpha1_Repository(in *Repository, out *v0alpha1.Repository, s conversion.Scope) error {
	in.ObjectMeta.DeepCopyInto(&out.ObjectMeta)
	if err := Convert_v1beta2_RepositorySpec_To_v0alpha1_RepositorySpec(&in.Spec, &out.Spec, s); err != nil {
		return err
	}
	secure, err := repositorySecureToV0alpha1(in.Secure)
	if err != nil {
		return err
	}
	out.Secure = secure
	return Convert_v1beta2_RepositoryStatus_To_v0alpha1_RepositoryStatus(&in.Status, &out.Status, s)
}

func Convert_v0alpha1_RepositoryList_To_v1beta2_RepositoryList(in *v0alpha1.RepositoryList, out *RepositoryList, s conversion.Scope) error {
	in.ListMeta.DeepCopyInto(&out.ListMeta)
	if in.Items == nil {
		out.Items = nil
		return nil
	}
	out.Items = make([]Repository, len(in.Items))
	for i := range in.Items {
		if err := Convert_v0alpha1_Repository_To_v1beta2_Repository(&in.Items[i], &out.Items[i], s); err != nil {
			return fmt.Errorf("items[%d]: %w", i, err)
		}
	}
	return nil
}

func Convert_v1beta2_RepositoryList_To_v0alpha1_RepositoryList(in *RepositoryList, out *v0alpha1.RepositoryList, s conversion.Scope) error {
	in.ListMeta.DeepCopyInto(&out.ListMeta)
	if in.Items == nil {
		out.Items = nil
		return nil
	}
	out.Items = make([]v0alpha1.Repository, len(in.Items))
	for i := range in.Items {
		if err := Convert_v1beta2_Repository_To_v0alpha1_Repository(&in.Items[i], &out.Items[i], s); err != nil {
			return fmt.Errorf("items[%d]: %w", i, err)
		}
	}
	return nil
}

func Convert_v0alpha1_RepositorySpec_To_v1beta2_RepositorySpec(in *v0alpha1.RepositorySpec, out *RepositorySpec, _ conversion.Scope) error {
	*out = RepositorySpec{
		Title:       in.Title,
		Description: repositoryNonZero(in.Description),
		Workflows:   repositoryConvertSlice(in.Workflows, func(w v0alpha1.Workflow) RepositorySpecWorkflows { return RepositorySpecWorkflows(w) }),
		Sync: RepositorySyncOptions{
			Enabled:         in.Sync.Enabled,
			Target:          RepositorySyncOptionsTarget(in.Sync.Target),
			IntervalSeconds: repositoryNonZero(in.Sync.IntervalSeconds),
		},
		Type: RepositorySpecType(in.Type),
	}
	if c := in.Commit; c != nil {
		out.Commit = &RepositoryCommitOptions{
			SingleResourceMessageTemplate: repositoryNonZero(c.SingleResourceMessageTemplate),
			EnforceTemplate:               repositoryNonZero(c.EnforceTemplate),
			AuthorName:                    repositoryNonZero(c.AuthorName),
			AuthorEmail:                   repositoryNonZero(c.AuthorEmail),
			SignerName:                    repositoryNonZero(c.SignerName),
			SignerEmail:                   repositoryNonZero(c.SignerEmail),
			SigningMethod:                 repositoryNonZero(RepositoryCommitOptionsSigningMethod(c.SigningMethod)),
			SignerIsAuthor:                repositoryNonZero(c.SignerIsAuthor),
			SmimeCertificate:              repositoryNonZero(c.SMIMECertificate),
		}
	}
	if b := in.Branch; b != nil {
		out.Branch = &RepositoryBranchOptions{
			NameTemplate:    repositoryNonZero(b.NameTemplate),
			EnforceTemplate: repositoryNonZero(b.EnforceTemplate),
		}
	}
	if pr := in.PullRequest; pr != nil {
		out.PullRequest = &RepositoryPullRequestOptions{
			TitleTemplate:             repositoryNonZero(pr.TitleTemplate),
			EnforceTemplate:           repositoryNonZero(pr.EnforceTemplate),
			GenerateDashboardPreviews: repositoryNonZero(pr.GenerateDashboardPreviews),
		}
	}
	if w := in.Webhook; w != nil {
		out.Webhook = &RepositoryWebhookConfig{
			BaseUrl:  repositoryNonZero(w.BaseURL),
			Disabled: repositoryNonZero(w.Disabled),
		}
	}
	if l := in.Local; l != nil {
		out.Local = &RepositoryLocalRepositoryConfig{Path: repositoryNonZero(l.Path)}
	}
	if g := in.GitHub; g != nil {
		out.Github = &RepositoryGitHubRepositoryConfig{
			Url:                       repositoryNonZero(g.URL),
			Branch:                    g.Branch,
			GenerateDashboardPreviews: repositoryNonZero(g.GenerateDashboardPreviews),
			Path:                      repositoryNonZero(g.Path),
		}
	}
	if g := in.GitHubEnterprise; g != nil {
		out.GithubEnterprise = &RepositoryGitHubEnterpriseRepositoryConfig{
			ServerUrl: repositoryNonZero(g.ServerURL),
			Url:       repositoryNonZero(g.URL),
			Branch:    g.Branch,
			Path:      repositoryNonZero(g.Path),
		}
	}
	if g := in.Git; g != nil {
		out.Git = &RepositoryGitRepositoryConfig{
			Url:       repositoryNonZero(g.URL),
			Branch:    g.Branch,
			TokenUser: repositoryNonZero(g.TokenUser),
			Path:      repositoryNonZero(g.Path),
		}
	}
	if b := in.Bitbucket; b != nil {
		out.Bitbucket = &RepositoryBitbucketRepositoryConfig{
			Url:       repositoryNonZero(b.URL),
			Branch:    b.Branch,
			TokenUser: repositoryNonZero(b.TokenUser),
			Email:     repositoryNonZero(b.Email),
			Path:      repositoryNonZero(b.Path),
		}
	}
	if g := in.GitLab; g != nil {
		out.Gitlab = &RepositoryGitLabRepositoryConfig{
			Url:    repositoryNonZero(g.URL),
			Branch: g.Branch,
			Path:   repositoryNonZero(g.Path),
			RepoID: repositoryNonZero(g.RepoID),
		}
	}
	if c := in.Connection; c != nil {
		out.Connection = &RepositoryConnectionInfo{Name: c.Name}
	}
	return nil
}

func Convert_v1beta2_RepositorySpec_To_v0alpha1_RepositorySpec(in *RepositorySpec, out *v0alpha1.RepositorySpec, _ conversion.Scope) error {
	*out = v0alpha1.RepositorySpec{
		Title:       in.Title,
		Description: repositoryValue(in.Description),
		Workflows:   repositoryConvertSlice(in.Workflows, func(w RepositorySpecWorkflows) v0alpha1.Workflow { return v0alpha1.Workflow(w) }),
		Sync: v0alpha1.SyncOptions{
			Enabled:         in.Sync.Enabled,
			Target:          v0alpha1.SyncTargetType(in.Sync.Target),
			IntervalSeconds: repositoryValue(in.Sync.IntervalSeconds),
		},
		Type: v0alpha1.RepositoryType(in.Type),
	}
	if c := in.Commit; c != nil {
		out.Commit = &v0alpha1.CommitOptions{
			SingleResourceMessageTemplate: repositoryValue(c.SingleResourceMessageTemplate),
			EnforceTemplate:               repositoryValue(c.EnforceTemplate),
			AuthorName:                    repositoryValue(c.AuthorName),
			AuthorEmail:                   repositoryValue(c.AuthorEmail),
			SignerName:                    repositoryValue(c.SignerName),
			SignerEmail:                   repositoryValue(c.SignerEmail),
			SigningMethod:                 v0alpha1.SigningMethod(repositoryValue(c.SigningMethod)),
			SignerIsAuthor:                repositoryValue(c.SignerIsAuthor),
			SMIMECertificate:              repositoryValue(c.SmimeCertificate),
		}
	}
	if b := in.Branch; b != nil {
		out.Branch = &v0alpha1.BranchOptions{
			NameTemplate:    repositoryValue(b.NameTemplate),
			EnforceTemplate: repositoryValue(b.EnforceTemplate),
		}
	}
	if pr := in.PullRequest; pr != nil {
		out.PullRequest = &v0alpha1.PullRequestOptions{
			TitleTemplate:             repositoryValue(pr.TitleTemplate),
			EnforceTemplate:           repositoryValue(pr.EnforceTemplate),
			GenerateDashboardPreviews: repositoryValue(pr.GenerateDashboardPreviews),
		}
	}
	if w := in.Webhook; w != nil {
		out.Webhook = &v0alpha1.WebhookConfig{
			BaseURL:  repositoryValue(w.BaseUrl),
			Disabled: repositoryValue(w.Disabled),
		}
	}
	if l := in.Local; l != nil {
		out.Local = &v0alpha1.LocalRepositoryConfig{Path: repositoryValue(l.Path)}
	}
	if g := in.Github; g != nil {
		out.GitHub = &v0alpha1.GitHubRepositoryConfig{
			URL:                       repositoryValue(g.Url),
			Branch:                    g.Branch,
			GenerateDashboardPreviews: repositoryValue(g.GenerateDashboardPreviews),
			Path:                      repositoryValue(g.Path),
		}
	}
	if g := in.GithubEnterprise; g != nil {
		out.GitHubEnterprise = &v0alpha1.GitHubEnterpriseRepositoryConfig{
			ServerURL: repositoryValue(g.ServerUrl),
			URL:       repositoryValue(g.Url),
			Branch:    g.Branch,
			Path:      repositoryValue(g.Path),
		}
	}
	if g := in.Git; g != nil {
		out.Git = &v0alpha1.GitRepositoryConfig{
			URL:       repositoryValue(g.Url),
			Branch:    g.Branch,
			TokenUser: repositoryValue(g.TokenUser),
			Path:      repositoryValue(g.Path),
		}
	}
	if b := in.Bitbucket; b != nil {
		out.Bitbucket = &v0alpha1.BitbucketRepositoryConfig{
			URL:       repositoryValue(b.Url),
			Branch:    b.Branch,
			TokenUser: repositoryValue(b.TokenUser),
			Email:     repositoryValue(b.Email),
			Path:      repositoryValue(b.Path),
		}
	}
	if g := in.Gitlab; g != nil {
		out.GitLab = &v0alpha1.GitLabRepositoryConfig{
			URL:    repositoryValue(g.Url),
			Branch: g.Branch,
			Path:   repositoryValue(g.Path),
			RepoID: repositoryValue(g.RepoID),
		}
	}
	if c := in.Connection; c != nil {
		out.Connection = &v0alpha1.ConnectionInfo{Name: c.Name}
	}
	return nil
}

func Convert_v0alpha1_RepositoryStatus_To_v1beta2_RepositoryStatus(in *v0alpha1.RepositoryStatus, out *RepositoryStatus, _ conversion.Scope) error {
	*out = RepositoryStatus{
		ObservedGeneration: in.ObservedGeneration,
		FieldErrors: repositoryConvertSlice(in.FieldErrors, func(e v0alpha1.ErrorDetails) RepositoryErrorDetails {
			return RepositoryErrorDetails{
				Type:     string(e.Type),
				Field:    repositoryNonZero(e.Field),
				Detail:   repositoryNonZero(e.Detail),
				Origin:   repositoryNonZero(e.Origin),
				BadValue: e.BadValue,
			}
		}),
		Conditions: repositoryConvertSlice(in.Conditions, repositoryConditionFromMeta),
		Health: RepositoryHealthStatus{
			Healthy: in.Health.Healthy,
			Error:   repositoryNonZero(RepositoryHealthFailureType(in.Health.Error)),
			Checked: repositoryNonZero(in.Health.Checked),
			Message: slices.Clone(in.Health.Message),
		},
		Sync: RepositorySyncStatus{
			State:       RepositoryJobState(in.Sync.State),
			Job:         repositoryNonZero(in.Sync.JobID),
			Started:     repositoryNonZero(in.Sync.Started),
			Finished:    repositoryNonZero(in.Sync.Finished),
			LastChecked: repositoryNonZero(in.Sync.LastChecked),
			Scheduled:   repositoryNonZero(in.Sync.Scheduled),
			Message:     slices.Clone(in.Sync.Message),
			LastRef:     repositoryNonZero(in.Sync.LastRef),
			Incremental: repositoryNonZero(in.Sync.Incremental),
		},
		Stats: repositoryConvertSlice(in.Stats, func(c v0alpha1.ResourceCount) RepositoryResourceCount {
			return RepositoryResourceCount{Group: c.Group, Resource: c.Resource, Count: c.Count}
		}),
		DeleteError: repositoryNonZero(in.DeleteError),
	}
	if w := in.Webhook; w != nil {
		out.Webhook = &RepositoryWebhookStatus{
			Id:               repositoryNonZero(w.ID),
			Uuid:             repositoryNonZero(w.UUID),
			Url:              repositoryNonZero(w.URL),
			SubscribedEvents: slices.Clone(w.SubscribedEvents),
			LastEvent:        repositoryNonZero(w.LastEvent),
			LastRotated:      repositoryNonZero(w.LastRotated),
		}
	}
	if in.Token != (v0alpha1.RepositoryTokenStatus{}) {
		out.Token = &RepositoryTokenStatus{
			LastUpdated: repositoryNonZero(in.Token.LastUpdated),
			Expiration:  repositoryNonZero(in.Token.Expiration),
		}
	}
	if d := in.Deletion; d != nil {
		out.Deletion = &RepositoryDeletionStatus{
			State:     repositoryNonZero(string(d.State)),
			Finalizer: repositoryNonZero(d.Finalizer),
			Message:   repositoryNonZero(d.Message),
			Cause:     repositoryNonZero(RepositoryDeletionStatusCause(d.Cause)),
		}
	}
	if in.Quota != (v0alpha1.QuotaStatus{}) {
		out.Quota = &RepositoryQuotaStatus{
			MaxRepositories:           repositoryNonZero(in.Quota.MaxRepositories),
			MaxResourcesPerRepository: repositoryNonZero(in.Quota.MaxResourcesPerRepository),
			UpdatedAt:                 repositoryNonZero(in.Quota.UpdatedAt),
		}
	}
	return nil
}

func Convert_v1beta2_RepositoryStatus_To_v0alpha1_RepositoryStatus(in *RepositoryStatus, out *v0alpha1.RepositoryStatus, _ conversion.Scope) error {
	conditions, err := repositoryConditionsToMeta(in.Conditions)
	if err != nil {
		return err
	}
	*out = v0alpha1.RepositoryStatus{
		ObservedGeneration: in.ObservedGeneration,
		FieldErrors: repositoryConvertSlice(in.FieldErrors, func(e RepositoryErrorDetails) v0alpha1.ErrorDetails {
			return v0alpha1.ErrorDetails{
				Type:     metav1.CauseType(e.Type),
				Field:    repositoryValue(e.Field),
				Detail:   repositoryValue(e.Detail),
				Origin:   repositoryValue(e.Origin),
				BadValue: e.BadValue,
			}
		}),
		Conditions: conditions,
		Health: v0alpha1.RepositoryHealthStatus{
			Healthy: in.Health.Healthy,
			Error:   v0alpha1.RepositoryHealthFailureType(repositoryValue(in.Health.Error)),
			Checked: repositoryValue(in.Health.Checked),
			Message: slices.Clone(in.Health.Message),
		},
		Sync: v0alpha1.SyncStatus{
			State:       v0alpha1.RepositoryJobState(in.Sync.State),
			JobID:       repositoryValue(in.Sync.Job),
			Started:     repositoryValue(in.Sync.Started),
			Finished:    repositoryValue(in.Sync.Finished),
			LastChecked: repositoryValue(in.Sync.LastChecked),
			Scheduled:   repositoryValue(in.Sync.Scheduled),
			Message:     slices.Clone(in.Sync.Message),
			LastRef:     repositoryValue(in.Sync.LastRef),
			Incremental: repositoryValue(in.Sync.Incremental),
		},
		Stats: repositoryConvertSlice(in.Stats, func(c RepositoryResourceCount) v0alpha1.ResourceCount {
			return v0alpha1.ResourceCount{Group: c.Group, Resource: c.Resource, Count: c.Count}
		}),
		DeleteError: repositoryValue(in.DeleteError),
	}
	if w := in.Webhook; w != nil {
		out.Webhook = &v0alpha1.WebhookStatus{
			ID:               repositoryValue(w.Id),
			UUID:             repositoryValue(w.Uuid),
			URL:              repositoryValue(w.Url),
			SubscribedEvents: slices.Clone(w.SubscribedEvents),
			LastEvent:        repositoryValue(w.LastEvent),
			LastRotated:      repositoryValue(w.LastRotated),
		}
	}
	if t := in.Token; t != nil {
		out.Token = v0alpha1.RepositoryTokenStatus{
			LastUpdated: repositoryValue(t.LastUpdated),
			Expiration:  repositoryValue(t.Expiration),
		}
	}
	if d := in.Deletion; d != nil {
		out.Deletion = &v0alpha1.DeletionStatus{
			State:     v0alpha1.DeletionState(repositoryValue(d.State)),
			Finalizer: repositoryValue(d.Finalizer),
			Message:   repositoryValue(d.Message),
			Cause:     v0alpha1.DeletionCause(repositoryValue(d.Cause)),
		}
	}
	if q := in.Quota; q != nil {
		out.Quota = v0alpha1.QuotaStatus{
			MaxRepositories:           repositoryValue(q.MaxRepositories),
			MaxResourcesPerRepository: repositoryValue(q.MaxResourcesPerRepository),
			UpdatedAt:                 repositoryValue(q.UpdatedAt),
		}
	}
	return nil
}

// repositorySecureFromV0alpha1 drops zero entries, which the v0alpha1 encoding omits as well.
func repositorySecureFromV0alpha1(in v0alpha1.SecureValues) resource.InlineSecureValues {
	out := resource.InlineSecureValues{}
	for key, value := range map[string]resource.InlineSecureValue{
		RepositorySecureToken:            in.Token,
		RepositorySecureWebhookSecret:    in.WebhookSecret,
		RepositorySecureCommitSigningKey: in.CommitSigningKey,
	} {
		if !value.IsZero() {
			out[key] = *value.DeepCopy()
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// repositorySecureToV0alpha1 rejects keys that v0alpha1 can't hold rather than dropping them,
// so a conversion never silently loses a secret.
func repositorySecureToV0alpha1(in resource.InlineSecureValues) (v0alpha1.SecureValues, error) {
	var out v0alpha1.SecureValues
	for key, value := range in {
		if value.IsZero() {
			continue
		}
		switch key {
		case RepositorySecureToken:
			out.Token = *value.DeepCopy()
		case RepositorySecureWebhookSecret:
			out.WebhookSecret = *value.DeepCopy()
		case RepositorySecureCommitSigningKey:
			out.CommitSigningKey = *value.DeepCopy()
		default:
			return v0alpha1.SecureValues{}, fmt.Errorf("secure: unsupported key %q, expected one of %v", key, RepositorySecureKeys)
		}
	}
	return out, nil
}

// repositoryConditionFromMeta writes lastTransitionTime the way metav1.Time encodes it: RFC3339 in
// UTC, whole seconds, null when zero.
func repositoryConditionFromMeta(c metav1.Condition) RepositoryCondition {
	out := RepositoryCondition{
		Type:               c.Type,
		Status:             string(c.Status),
		ObservedGeneration: repositoryNonZero(c.ObservedGeneration),
		Reason:             c.Reason,
		Message:            c.Message,
	}
	if !c.LastTransitionTime.IsZero() {
		out.LastTransitionTime = new(c.LastTransitionTime.UTC().Format(time.RFC3339))
	}
	return out
}

func repositoryConditionsToMeta(in []RepositoryCondition) ([]metav1.Condition, error) {
	if in == nil {
		return nil, nil
	}
	out := make([]metav1.Condition, len(in))
	for i, c := range in {
		out[i] = metav1.Condition{
			Type:               c.Type,
			Status:             metav1.ConditionStatus(c.Status),
			ObservedGeneration: repositoryValue(c.ObservedGeneration),
			Reason:             c.Reason,
			Message:            c.Message,
		}
		if c.LastTransitionTime == nil {
			continue
		}
		t, err := time.Parse(time.RFC3339, *c.LastTransitionTime)
		if err != nil {
			return nil, fmt.Errorf("status.conditions[%d].lastTransitionTime: %w", i, err)
		}
		// Local, as decoding the JSON into metav1.Time produces.
		out[i].LastTransitionTime = metav1.NewTime(t.Local())
	}
	return out, nil
}

// repositoryNonZero maps the zero value, which v0alpha1 omits from JSON, to nil.
func repositoryNonZero[T comparable](v T) *T {
	var zero T
	if v == zero {
		return nil
	}
	return &v
}

func repositoryValue[T any](p *T) T {
	if p == nil {
		var zero T
		return zero
	}
	return *p
}

// repositoryConvertSlice keeps nil and empty slices apart, since some of them encode without omitempty.
func repositoryConvertSlice[In, Out any](in []In, convert func(In) Out) []Out {
	if in == nil {
		return nil
	}
	out := make([]Out, len(in))
	for i, v := range in {
		out[i] = convert(v)
	}
	return out
}
