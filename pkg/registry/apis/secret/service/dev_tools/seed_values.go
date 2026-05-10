package dev_tools

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"
)

const (
	seedActorUID = "seed-actor"
)

// randString returns a string of length n from the given charset.
func randString(charset string, n int, rng *rand.Rand) string {
	b := make([]byte, n)
	for i := range b {
		b[i] = charset[rng.Intn(len(charset))]
	}
	return string(b)
}

// SeedSecureValues creates random namespaces and secrets by calling Create on the service.
// Useful for testing or load testing. Each namespace gets an active keeper implicitly (system keeper).
// Warning: Should not be called by production code.
func SeedSecureValues(ctx context.Context, svc contracts.SecureValueService, numberOfNamespaces, maxSecretsPerNamespace int) error {
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	nsChars := "abcdefghijklmnopqrstuvwxyz0123456789"
	// Description: 1–25 chars; keep short for readability
	descLen := 10
	// Value: 1–24576 bytes; use small values for seeding
	valueLen := 24

	for i := 0; i < numberOfNamespaces; i++ {
		namespace := "ns-" + randString(nsChars, 12, rng)
		nSecrets := maxSecretsPerNamespace
		if nSecrets < 1 {
			nSecrets = 1
		}
		nSecrets = rng.Intn(nSecrets) + 1 // [1, maxSecretsPerNamespace] per namespace
		for j := 0; j < nSecrets; j++ {
			name := "sv-" + randString(nsChars, 8, rng)
			description := randString(nsChars, descLen, rng)
			value := randString(nsChars, valueLen, rng)
			sv := &secretv1beta1.SecureValue{
				ObjectMeta: metav1.ObjectMeta{
					Name:      name,
					Namespace: namespace,
				},
				Spec: secretv1beta1.SecureValueSpec{
					Description: description,
					Value:       ptr.To(secretv1beta1.NewExposedSecureValue(value)),
					Decrypters:  []string{"decrypter1"},
				},
				Status: secretv1beta1.SecureValueStatus{},
			}
			_, err := svc.Create(ctx, sv, seedActorUID)
			if err != nil {
				return fmt.Errorf("create secure value namespace=%s name=%s: %w", namespace, name, err)
			}
		}
	}
	return nil
}
