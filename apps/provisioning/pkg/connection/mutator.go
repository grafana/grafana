package connection

import (
	"cmp"
	"context"
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/bwmarrin/snowflake"
	"github.com/google/uuid"
	"k8s.io/apiserver/pkg/admission"

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
	if obj == nil {
		return nil
	}

	c, ok := obj.(*provisioning.Connection)
	if !ok {
		return fmt.Errorf("expected connection configuration, got %T", obj)
	}

	namePrefix := fmt.Sprintf("%s-", c.Spec.Type)
	if a.GetOperation() == admission.Create && c.GetName() == "" {
		c.SetName(cmp.Or(c.GetGenerateName(), namePrefix) + generateShortUID())
	}

	return m.factory.Mutate(ctx, c)
}

// CopySecureValues copies secure values from old to new connection if they are zero in the new one.
// This preserves existing secrets during updates when they are not provided in the new object.
func CopySecureValues(new, old *provisioning.Connection) {
	if old == nil || old.Secure.IsZero() {
		return
	}
	if new.Secure.PrivateKey.IsZero() {
		new.Secure.PrivateKey = old.Secure.PrivateKey
	}
	if new.Secure.Token.IsZero() {
		new.Secure.Token = old.Secure.Token
	}
	if new.Secure.ClientSecret.IsZero() {
		new.Secure.ClientSecret = old.Secure.ClientSecret
	}
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
		uid, err := uuid.NewRandom()
		if err != nil {
			// This should never happen... but this seems better than a panic
			for i := range uid {
				uid[i] = byte(uidrand.Intn(255))
			}
		}
		uuid := uid.String()
		if rune(uuid[0]) < rune('a') {
			uuid = string(hexLetters[uidrand.Intn(len(hexLetters))]) + uuid[1:]
		}
		return uuid
	}

	return string(hexLetters[uidrand.Intn(len(hexLetters))]) + // start with a letter
		node.Generate().Base36() +
		string(hexLetters[uidrand.Intn(len(hexLetters))]) // a bit more entropy
}
