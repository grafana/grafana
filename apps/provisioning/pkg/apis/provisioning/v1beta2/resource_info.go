package v1beta2

import (
	"errors"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/apps/provisioning/pkg/util/optional"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// The table columns match the v0alpha1 ones, so `kubectl get` prints the same for every version.

var RepositoryResourceInfo = utils.NewResourceInfo(APIGroup, APIVersion,
	"repositories", "repository", "Repository",
	func() runtime.Object { return &Repository{} },
	func() runtime.Object { return &RepositoryList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Created At", Type: "date"},
			{Name: "Title", Type: "string"},
			{Name: "Type", Type: "string"},
			{Name: "Target", Type: "string"},
		},
		Reader: func(obj any) ([]any, error) {
			m, ok := obj.(*Repository)
			if !ok {
				return nil, errors.New("expected Repository")
			}
			return []any{
				m.Name,
				m.CreationTimestamp.UTC().Format(time.RFC3339),
				m.Spec.Title,
				m.Spec.Type,
				repositoryTarget(m.Spec),
			}, nil
		},
	})

func repositoryTarget(spec RepositorySpec) string {
	switch {
	case spec.Type == RepositorySpecTypeLocal && spec.Local != nil:
		return optional.Value(spec.Local.Path)
	case spec.Type == RepositorySpecTypeGithub && spec.Github != nil:
		return optional.Value(spec.Github.Url)
	case spec.Type == RepositorySpecTypeGithubEnterprise && spec.GithubEnterprise != nil:
		return optional.Value(spec.GithubEnterprise.Url)
	case spec.Type == RepositorySpecTypeGit && spec.Git != nil:
		return optional.Value(spec.Git.Url)
	case spec.Type == RepositorySpecTypeBitbucket && spec.Bitbucket != nil:
		return optional.Value(spec.Bitbucket.Url)
	case spec.Type == RepositorySpecTypeGitlab && spec.Gitlab != nil:
		return optional.Value(spec.Gitlab.Url)
	default:
		return ""
	}
}

var ConnectionResourceInfo = utils.NewResourceInfo(APIGroup, APIVersion,
	"connections", "connection", "Connection",
	func() runtime.Object { return &Connection{} },
	func() runtime.Object { return &ConnectionList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Created At", Type: "date"},
			{Name: "Type", Type: "string"},
			{Name: "AppID", Type: "string"},
			{Name: "InstallationID", Type: "string"},
			{Name: "ClientID", Type: "string"},
		},
		Reader: func(obj any) ([]any, error) {
			m, ok := obj.(*Connection)
			if !ok {
				return nil, errors.New("expected Connection")
			}

			var appID, installationID, clientID string
			switch {
			case m.Spec.Type == ConnectionTypeGithub && m.Spec.Github != nil:
				appID, installationID = m.Spec.Github.AppID, m.Spec.Github.InstallationID
			case m.Spec.Type == ConnectionTypeGithubEnterprise && m.Spec.GithubEnterprise != nil:
				appID, installationID = m.Spec.GithubEnterprise.AppID, m.Spec.GithubEnterprise.InstallationID
			}
			if m.Spec.Oauth != nil {
				clientID = m.Spec.Oauth.ClientID
			}

			return []any{
				m.Name,
				m.CreationTimestamp.UTC().Format(time.RFC3339),
				m.Spec.Type,
				appID,
				installationID,
				clientID,
			}, nil
		},
	})

var jobColumns = []metav1.TableColumnDefinition{
	{Name: "Name", Type: "string", Format: "name"},
	{Name: "Created At", Type: "date"},
	{Name: "Action", Type: "string"},
	{Name: "State", Type: "string"},
	{Name: "Message", Type: "string"},
}

var JobResourceInfo = utils.NewResourceInfo(APIGroup, APIVersion,
	"jobs", "job", "Job",
	func() runtime.Object { return &Job{} },
	func() runtime.Object { return &JobList{} },
	utils.TableColumns{
		Definition: jobColumns,
		Reader: func(obj any) ([]any, error) {
			m, ok := obj.(*Job)
			if !ok {
				return nil, errors.New("expected Job")
			}
			return []any{
				m.Name,
				m.CreationTimestamp.UTC().Format(time.RFC3339),
				m.Spec.Action,
				optional.Value(m.Status.State),
				optional.Value(m.Status.Message),
			}, nil
		},
	})

var HistoricJobResourceInfo = utils.NewResourceInfo(APIGroup, APIVersion,
	"historicjobs", "historicjob", "HistoricJob",
	func() runtime.Object { return &HistoricJob{} },
	func() runtime.Object { return &HistoricJobList{} },
	utils.TableColumns{
		Definition: jobColumns,
		Reader: func(obj any) ([]any, error) {
			m, ok := obj.(*HistoricJob)
			if !ok {
				return nil, errors.New("expected HistoricJob")
			}
			return []any{
				m.Name,
				m.CreationTimestamp.UTC().Format(time.RFC3339),
				m.Spec.Action,
				optional.Value(m.Status.State),
				optional.Value(m.Status.Message),
			}, nil
		},
	})
