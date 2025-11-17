package provisioning

import (
	"context"
	"testing"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authentication/user"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestAPIBuilderValidate(t *testing.T) {
	factory := repository.NewMockFactory(t)
	mockRepo := repository.NewMockConfigRepository(t)
	mockRepo.EXPECT().Validate().Return(nil)
	factory.EXPECT().Build(mock.Anything, mock.Anything).Return(mockRepo, nil)
	validator := repository.NewValidator(30*time.Second, []v0alpha1.SyncTargetType{v0alpha1.SyncTargetTypeFolder}, false)
	b := &APIBuilder{
		repoFactory:         factory,
		allowedTargets:      []v0alpha1.SyncTargetType{v0alpha1.SyncTargetTypeFolder},
		allowImageRendering: false,
		validator:           validator,
	}

	t.Run("min sync interval is less than 10 seconds", func(t *testing.T) {
		cfg := &v0alpha1.Repository{
			Spec: v0alpha1.RepositorySpec{
				Title: "repo",
				Type:  v0alpha1.GitHubRepositoryType,
				Sync:  v0alpha1.SyncOptions{Enabled: true, Target: v0alpha1.SyncTargetTypeFolder, IntervalSeconds: 5},
			},
		}
		mockRepo.EXPECT().Config().Return(cfg)

		obj := newRepoObj("repo1", "default", cfg.Spec, v0alpha1.RepositoryStatus{})
		err := b.Validate(context.Background(), newAttributes(obj, nil, admission.Create), nil)
		require.Error(t, err)
		require.True(t, apierrors.IsInvalid(err))
	})

	t.Run("image rendering is not enabled", func(t *testing.T) {
		cfg2 := &v0alpha1.Repository{
			Spec: v0alpha1.RepositorySpec{
				Title:  "repo",
				Type:   v0alpha1.GitHubRepositoryType,
				Sync:   v0alpha1.SyncOptions{Enabled: false, Target: v0alpha1.SyncTargetTypeFolder},
				GitHub: &v0alpha1.GitHubRepositoryConfig{URL: "https://github.com/acme/repo", Branch: "main", GenerateDashboardPreviews: true},
			},
		}
		mockRepo.EXPECT().Config().Return(cfg2)

		obj := newRepoObj("repo2", "default", cfg2.Spec, v0alpha1.RepositoryStatus{})
		err := b.Validate(context.Background(), newAttributes(obj, nil, admission.Create), nil)
		require.Error(t, err)
		require.True(t, apierrors.IsInvalid(err))
	})

	t.Run("sync target is not supported", func(t *testing.T) {
		cfg3 := &v0alpha1.Repository{
			Spec: v0alpha1.RepositorySpec{
				Title: "repo",
				Type:  v0alpha1.GitHubRepositoryType,
				Sync:  v0alpha1.SyncOptions{Enabled: true, Target: v0alpha1.SyncTargetTypeInstance},
			},
		}
		mockRepo.EXPECT().Config().Return(cfg3)

		obj := newRepoObj("repo3", "default", cfg3.Spec, v0alpha1.RepositoryStatus{})
		err := b.Validate(context.Background(), newAttributes(obj, nil, admission.Create), nil)
		require.Error(t, err)
		require.True(t, apierrors.IsInvalid(err))
	})
}

func newRepoObj(name string, ns string, spec v0alpha1.RepositorySpec, status v0alpha1.RepositoryStatus) *v0alpha1.Repository {
	return &v0alpha1.Repository{
		TypeMeta:   metav1.TypeMeta{APIVersion: v0alpha1.APIVERSION, Kind: "Repository"},
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns},
		Spec:       spec,
		Status:     status,
	}
}

func newAttributes(obj, old runtime.Object, op admission.Operation) admission.Attributes {
	return admission.NewAttributesRecord(
		obj,
		old,
		v0alpha1.RepositoryResourceInfo.GroupVersionKind(),
		"default",
		func() string {
			if obj != nil {
				return obj.(*v0alpha1.Repository).Name
			}
			if old != nil {
				return old.(*v0alpha1.Repository).Name
			}
			return ""
		}(),
		v0alpha1.RepositoryResourceInfo.GroupVersionResource(),
		"",
		op,
		nil,
		false,
		&user.DefaultInfo{},
	)
}
