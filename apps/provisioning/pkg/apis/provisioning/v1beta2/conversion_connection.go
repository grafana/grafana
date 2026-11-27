package v1beta2

import (
	"fmt"
	"slices"

	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/util/optional"
)

// Keys of the Connection secure values, matching the JSON names of the v0alpha1 ConnectionSecure fields.
const (
	ConnectionSecurePrivateKey   = "privateKey"
	ConnectionSecureClientSecret = "clientSecret"
	ConnectionSecureToken        = "token"
)

// ConnectionSecureKeys lists the only keys a Connection secure map may hold, because v0alpha1 has a field per key.
var ConnectionSecureKeys = []string{ConnectionSecurePrivateKey, ConnectionSecureClientSecret, ConnectionSecureToken}

// RegisterConnectionConversions registers the Connection and ConnectionList conversions between v0alpha1 and v1beta2.
func RegisterConnectionConversions(s *runtime.Scheme) error {
	if err := s.AddConversionFunc((*v0alpha1.Connection)(nil), (*Connection)(nil), func(a, b any, scope conversion.Scope) error {
		return Convert_v0alpha1_Connection_To_v1beta2_Connection(a.(*v0alpha1.Connection), b.(*Connection), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*Connection)(nil), (*v0alpha1.Connection)(nil), func(a, b any, scope conversion.Scope) error {
		return Convert_v1beta2_Connection_To_v0alpha1_Connection(a.(*Connection), b.(*v0alpha1.Connection), scope)
	}); err != nil {
		return err
	}
	if err := s.AddConversionFunc((*v0alpha1.ConnectionList)(nil), (*ConnectionList)(nil), func(a, b any, scope conversion.Scope) error {
		return Convert_v0alpha1_ConnectionList_To_v1beta2_ConnectionList(a.(*v0alpha1.ConnectionList), b.(*ConnectionList), scope)
	}); err != nil {
		return err
	}
	return s.AddConversionFunc((*ConnectionList)(nil), (*v0alpha1.ConnectionList)(nil), func(a, b any, scope conversion.Scope) error {
		return Convert_v1beta2_ConnectionList_To_v0alpha1_ConnectionList(a.(*ConnectionList), b.(*v0alpha1.ConnectionList), scope)
	})
}

func Convert_v0alpha1_Connection_To_v1beta2_Connection(in *v0alpha1.Connection, out *Connection, _ conversion.Scope) error {
	out.TypeMeta = metav1.TypeMeta{APIVersion: GroupVersion.String(), Kind: "Connection"}
	in.ObjectMeta.DeepCopyInto(&out.ObjectMeta)
	out.Spec = connectionSpecFromV0(in.Spec)
	out.Secure = connectionSecureFromV0(in.Secure)
	out.Status = connectionStatusFromV0(in.Status)
	return nil
}

func Convert_v1beta2_Connection_To_v0alpha1_Connection(in *Connection, out *v0alpha1.Connection, _ conversion.Scope) error {
	secure, err := connectionSecureToV0(in.Secure)
	if err != nil {
		return err
	}
	status, err := connectionStatusToV0(in.Status)
	if err != nil {
		return fmt.Errorf("convert connection %q: %w", in.Name, err)
	}
	out.TypeMeta = metav1.TypeMeta{APIVersion: v0alpha1.SchemeGroupVersion.String(), Kind: "Connection"}
	in.ObjectMeta.DeepCopyInto(&out.ObjectMeta)
	out.Spec = connectionSpecToV0(in.Spec)
	out.Secure = secure
	out.Status = status
	return nil
}

func Convert_v0alpha1_ConnectionList_To_v1beta2_ConnectionList(in *v0alpha1.ConnectionList, out *ConnectionList, scope conversion.Scope) error {
	out.TypeMeta = metav1.TypeMeta{APIVersion: GroupVersion.String(), Kind: "ConnectionList"}
	in.ListMeta.DeepCopyInto(&out.ListMeta)
	out.Items = nil
	if in.Items != nil {
		out.Items = make([]Connection, len(in.Items))
	}
	for i := range in.Items {
		if err := Convert_v0alpha1_Connection_To_v1beta2_Connection(&in.Items[i], &out.Items[i], scope); err != nil {
			return err
		}
	}
	return nil
}

func Convert_v1beta2_ConnectionList_To_v0alpha1_ConnectionList(in *ConnectionList, out *v0alpha1.ConnectionList, scope conversion.Scope) error {
	out.TypeMeta = metav1.TypeMeta{APIVersion: v0alpha1.SchemeGroupVersion.String(), Kind: "ConnectionList"}
	in.ListMeta.DeepCopyInto(&out.ListMeta)
	out.Items = nil
	if in.Items != nil {
		out.Items = make([]v0alpha1.Connection, len(in.Items))
	}
	for i := range in.Items {
		if err := Convert_v1beta2_Connection_To_v0alpha1_Connection(&in.Items[i], &out.Items[i], scope); err != nil {
			return err
		}
	}
	return nil
}

func connectionSpecFromV0(in v0alpha1.ConnectionSpec) ConnectionSpec {
	out := ConnectionSpec{
		Title:       in.Title,
		Description: optional.NonZero(in.Description),
		Type:        ConnectionType(in.Type),
		Url:         optional.NonZero(in.URL),
	}
	if in.GitHub != nil {
		out.Github = &ConnectionGitHubConfig{AppID: in.GitHub.AppID, InstallationID: in.GitHub.InstallationID}
	}
	if in.GitHubEnterprise != nil {
		out.GithubEnterprise = &ConnectionGitHubEnterpriseConfig{
			AppID:          in.GitHubEnterprise.AppID,
			InstallationID: in.GitHubEnterprise.InstallationID,
			ServerUrl:      in.GitHubEnterprise.ServerURL,
		}
	}
	if in.GitHubEnterpriseOAuth != nil {
		out.GithubEnterpriseOAuth = &ConnectionGitHubEnterpriseOAuthConfig{ServerUrl: in.GitHubEnterpriseOAuth.ServerURL}
	}
	if in.Bitbucket != nil {
		out.Bitbucket = &ConnectionBitbucketConfig{Workspace: in.Bitbucket.Workspace}
	}
	if in.GitOAuth != nil {
		out.GitOAuth = &ConnectionGitOAuthConfig{
			AuthURL:  in.GitOAuth.AuthURL,
			TokenURL: in.GitOAuth.TokenURL,
			Scopes:   slices.Clone(in.GitOAuth.Scopes),
		}
	}
	if in.OAuth != nil {
		out.Oauth = &ConnectionOAuthConfig{ClientID: in.OAuth.ClientID}
	}
	if in.Webhook != nil {
		out.Webhook = &ConnectionWebhookConfig{Disabled: optional.NonZero(in.Webhook.Disabled)}
	}
	return out
}

func connectionSpecToV0(in ConnectionSpec) v0alpha1.ConnectionSpec {
	out := v0alpha1.ConnectionSpec{
		Title:       in.Title,
		Description: optional.Value(in.Description),
		Type:        v0alpha1.ConnectionType(in.Type),
		URL:         optional.Value(in.Url),
	}
	if in.Github != nil {
		out.GitHub = &v0alpha1.GitHubConnectionConfig{AppID: in.Github.AppID, InstallationID: in.Github.InstallationID}
	}
	if in.GithubEnterprise != nil {
		out.GitHubEnterprise = &v0alpha1.GitHubEnterpriseConnectionConfig{
			AppID:          in.GithubEnterprise.AppID,
			InstallationID: in.GithubEnterprise.InstallationID,
			ServerURL:      in.GithubEnterprise.ServerUrl,
		}
	}
	if in.GithubEnterpriseOAuth != nil {
		out.GitHubEnterpriseOAuth = &v0alpha1.GitHubEnterpriseOAuthConnectionConfig{ServerURL: in.GithubEnterpriseOAuth.ServerUrl}
	}
	if in.Bitbucket != nil {
		out.Bitbucket = &v0alpha1.BitbucketConnectionConfig{Workspace: in.Bitbucket.Workspace}
	}
	if in.GitOAuth != nil {
		out.GitOAuth = &v0alpha1.GitOAuthConnectionConfig{
			AuthURL:  in.GitOAuth.AuthURL,
			TokenURL: in.GitOAuth.TokenURL,
			Scopes:   slices.Clone(in.GitOAuth.Scopes),
		}
	}
	if in.Oauth != nil {
		out.OAuth = &v0alpha1.ConnectionOAuthConfig{ClientID: in.Oauth.ClientID}
	}
	if in.Webhook != nil {
		out.Webhook = &v0alpha1.ConnectionWebhookConfig{Disabled: optional.Value(in.Webhook.Disabled)}
	}
	return out
}

// connectionSecureFromV0 drops zero values, which the v0alpha1 JSON encoding omits too.
func connectionSecureFromV0(in v0alpha1.ConnectionSecure) resource.InlineSecureValues {
	var out resource.InlineSecureValues
	for key, value := range map[string]resource.InlineSecureValue{
		ConnectionSecurePrivateKey:   in.PrivateKey,
		ConnectionSecureClientSecret: in.ClientSecret,
		ConnectionSecureToken:        in.Token,
	} {
		if value.IsZero() {
			continue
		}
		if out == nil {
			out = resource.InlineSecureValues{}
		}
		out[key] = *value.DeepCopy()
	}
	return out
}

func connectionSecureToV0(in resource.InlineSecureValues) (v0alpha1.ConnectionSecure, error) {
	var out v0alpha1.ConnectionSecure
	for key, value := range in {
		if value.IsZero() {
			continue
		}
		value = *value.DeepCopy()
		switch key {
		case ConnectionSecurePrivateKey:
			out.PrivateKey = value
		case ConnectionSecureClientSecret:
			out.ClientSecret = value
		case ConnectionSecureToken:
			out.Token = value
		default:
			return v0alpha1.ConnectionSecure{}, fmt.Errorf("unknown connection secure value %q, expected one of %v", key, ConnectionSecureKeys)
		}
	}
	return out, nil
}

func connectionStatusFromV0(in v0alpha1.ConnectionStatus) ConnectionStatus {
	out := ConnectionStatus{
		ObservedGeneration: in.ObservedGeneration,
		Conditions:         ConditionsFromMeta[ConnectionCondition](in.Conditions),
		Health: ConnectionHealthStatus{
			Healthy: in.Health.Healthy,
			Error:   optional.NonZero(ConnectionHealthFailureType(in.Health.Error)),
			Checked: optional.NonZero(in.Health.Checked),
			Message: slices.Clone(in.Health.Message),
		},
	}
	if in.FieldErrors != nil {
		out.FieldErrors = make([]ConnectionErrorDetails, len(in.FieldErrors))
		for i, e := range in.FieldErrors {
			out.FieldErrors[i] = ConnectionErrorDetails{
				Type:     string(e.Type),
				Field:    optional.NonZero(e.Field),
				Detail:   optional.NonZero(e.Detail),
				Origin:   optional.NonZero(e.Origin),
				BadValue: e.BadValue,
			}
		}
	}
	if in.Token != (v0alpha1.ConnectionTokenStatus{}) {
		out.Token = &ConnectionTokenStatus{
			LastUpdated: optional.NonZero(in.Token.LastUpdated),
			Expiration:  optional.NonZero(in.Token.Expiration),
		}
	}
	return out
}

func connectionStatusToV0(in ConnectionStatus) (v0alpha1.ConnectionStatus, error) {
	conditions, err := ConditionsToMeta(field.NewPath("status", "conditions"), in.Conditions)
	if err != nil {
		return v0alpha1.ConnectionStatus{}, err
	}
	out := v0alpha1.ConnectionStatus{
		ObservedGeneration: in.ObservedGeneration,
		Conditions:         conditions,
		Health: v0alpha1.ConnectionHealthStatus{
			Healthy: in.Health.Healthy,
			Error:   v0alpha1.ConnectionHealthFailureType(optional.Value(in.Health.Error)),
			Checked: optional.Value(in.Health.Checked),
			Message: slices.Clone(in.Health.Message),
		},
	}
	if in.FieldErrors != nil {
		out.FieldErrors = make([]v0alpha1.ConnectionErrorDetails, len(in.FieldErrors))
		for i, e := range in.FieldErrors {
			out.FieldErrors[i] = v0alpha1.ConnectionErrorDetails{
				Type:     metav1.CauseType(e.Type),
				Field:    optional.Value(e.Field),
				Detail:   optional.Value(e.Detail),
				Origin:   optional.Value(e.Origin),
				BadValue: e.BadValue,
			}
		}
	}
	if in.Token != nil {
		out.Token = v0alpha1.ConnectionTokenStatus{
			LastUpdated: optional.Value(in.Token.LastUpdated),
			Expiration:  optional.Value(in.Token.Expiration),
		}
	}
	return out, nil
}
