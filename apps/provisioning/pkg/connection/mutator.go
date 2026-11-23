package connection

import (
	"cmp"
	"context"
	"fmt"
	"math/rand"
	"slices"
	"sync"
	"time"
	"uuid"

	"github.com/bwmarrin/snowflake"
	"k8s.io/apiserver/pkg/admission"

	"github.com/grafana/grafana-app-sdk/resource"
	provisioningadmission "github.com/grafana/grafana/apps/provisioning/pkg/apis/admission"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// AdmissionMutator handles mutation for Connection resources
type AdmissionMutator struct {
	factory Factory
}

// NewAdmissionMutator creates a new connection mutator
func NewAdmissionMutator(factory Factory) *AdmissionMutator {
	return &AdmissionMutator{
		factory: factory,
	}
}

// Mutate applies mutations to Connection resources
func (m *AdmissionMutator) Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	obj := a.GetObject()
	// Status patches from any client must store conditions as metav1.Condition did.
	if c, ok := obj.(*provisioning.Connection); ok {
		c.Status.Conditions = provisioning.NormalizeConditions(c.Status.Conditions)
	}

	if a.GetSubresource() != "" && !provisioningadmission.SpecAndSecureChanged(a) {
		return nil // pure status patch: spec/secure untouched, nothing to (re)mutate
	}

	if obj == nil {
		return nil
	}

	c, ok := obj.(*provisioning.Connection)
	if !ok {
		return fmt.Errorf("expected connection configuration, got %T", obj)
	}
	c.NormalizeSecureValues()

	namePrefix := fmt.Sprintf("%s-", c.Spec.Type)
	if a.GetOperation() == admission.Create && c.GetName() == "" {
		c.SetName(cmp.Or(c.GetGenerateName(), namePrefix) + generateShortUID())
	}

	if a.GetOperation() == admission.Update {
		if old, ok := a.GetOldObject().(*provisioning.Connection); ok && oauthAppChanged(c, old) {
			c.SetSecureValue(provisioning.ConnectionSecureToken, resource.InlineSecureValue{Remove: true})
		}
	}

	return m.factory.Mutate(ctx, c)
}

// CopySecureValues copies secure values from old to new connection if they are zero in the new one.
// This preserves existing secrets during updates when they are not provided in the new object.
func CopySecureValues(new, old *provisioning.Connection) {
	if old == nil {
		return
	}
	for _, key := range provisioning.ConnectionSecureKeys {
		if new.Secure[key].IsZero() {
			new.SetSecureValue(key, old.Secure[key])
		}
	}
}

// oauthAppChanged reports whether an update changes the OAuth app the
// stored token was minted by: its credentials or the provider it lives on
// (type and, for self-hosted providers, URL). The token is removed in that
// case: it belongs to the previous app and the user must authorize again.
func oauthAppChanged(new, old *provisioning.Connection) bool {
	if new.Spec.Oauth == nil && old.Spec.Oauth == nil {
		return false
	}
	if new.Spec.Oauth == nil || old.Spec.Oauth == nil {
		return true
	}
	if new.Spec.Type != old.Spec.Type || new.Spec.Url != old.Spec.Url || new.Spec.Oauth.ClientID != old.Spec.Oauth.ClientID {
		return true
	}
	if githubEnterpriseServerURL(new) != githubEnterpriseServerURL(old) || gitOAuthTokenURL(new) != gitOAuthTokenURL(old) ||
		!slices.Equal(gitOAuthScopes(new), gitOAuthScopes(old)) {
		return true
	}
	clientSecret := new.Secure[provisioning.ConnectionSecureClientSecret]
	return !clientSecret.Create.IsZero() ||
		(clientSecret.Name != "" && clientSecret.Name != old.Secure[provisioning.ConnectionSecureClientSecret].Name)
}

func githubEnterpriseServerURL(c *provisioning.Connection) string {
	if c.Spec.GithubEnterpriseOAuth == nil {
		return ""
	}
	return c.Spec.GithubEnterpriseOAuth.ServerUrl
}

func gitOAuthTokenURL(c *provisioning.Connection) string {
	if c.Spec.GitOAuth == nil {
		return ""
	}
	return c.Spec.GitOAuth.TokenURL
}

func gitOAuthScopes(c *provisioning.Connection) []string {
	if c.Spec.GitOAuth == nil {
		return nil
	}
	return c.Spec.GitOAuth.Scopes
}

/*
NOTE: the code below is copied from pkg/util/shortid_generator.go.
That function is part of core grafana, which we don't want to have as a dependency.
TODO: use the util package once it's inside a separate go module.
*/

// We want to protect our number generator as they are not thread safe. Not using
// the mutex could result in panics in certain cases where UIDs would be generated
// at the same time.
var mtx sync.Mutex

var node *snowflake.Node

var uidrand = rand.New(rand.NewSource(time.Now().UnixNano()))
var hexLetters = []rune("abcdef")

// generateShortUID will generate a UUID that can also be a k8s name
// it is guaranteed to have a character as the first letter
// This UID will be a valid k8s name
func generateShortUID() string {
	mtx.Lock()
	defer mtx.Unlock()

	if node == nil {
		// ignoring the error happens when input outside 0-1023
		node, _ = snowflake.NewNode(rand.Int63n(1024))
	}

	// Use UUIDs if snowflake failed (should be never)
	if node == nil {
		uuid := uuid.NewV4().String()
		if rune(uuid[0]) < rune('a') {
			uuid = string(hexLetters[uidrand.Intn(len(hexLetters))]) + uuid[1:]
		}
		return uuid
	}

	return string(hexLetters[uidrand.Intn(len(hexLetters))]) + // start with a letter
		node.Generate().Base36() +
		string(hexLetters[uidrand.Intn(len(hexLetters))]) // a bit more entropy
}
