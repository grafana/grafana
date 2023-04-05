package client

import (
	"context"
	"encoding/json"
	"fmt"

	admissionregistrationV1 "k8s.io/api/admissionregistration/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

// Converts shortwebhookconfigs into full k8s mutationwebhookconfigurations and registers them
func (c *Clientset) RegisterMutation(ctx context.Context, webhooks []ShortWebhookConfig) error {
	for _, hook := range webhooks {
		obj := convertShortWebhookToMutationWebhook(c.GetCABundle(), hook)
		force := true
		patchOpts := metav1.PatchOptions{FieldManager: GrafanaFieldManager, Force: &force}
		data, err := json.Marshal(obj)
		if err != nil {
			return err
		}
		_, err = c.admissionRegistration.MutatingWebhookConfigurations().Patch(context.Background(), obj.Name, types.ApplyPatchType, data, patchOpts)
		if err != nil {
			return err
		}
	}

	return nil
}

// Converts shortwebhookconfig into a mutatingwebhookconfiguration
func convertShortWebhookToMutationWebhook(caBundle []byte, swc ShortWebhookConfig) *admissionregistrationV1.MutatingWebhookConfiguration {
	metaName := fmt.Sprintf("mutation.%s.core.grafana.com", swc.Kind.MachineName())

	resourcePlural := swc.Kind.Props().Common().PluralMachineName

	return &admissionregistrationV1.MutatingWebhookConfiguration{
		TypeMeta: metav1.TypeMeta{
			Kind:       "MutatingWebhookConfiguration",
			APIVersion: "admissionregistration.k8s.io/v1",
		},
		ObjectMeta: metav1.ObjectMeta{Name: metaName},
		Webhooks: []admissionregistrationV1.MutatingWebhook{
			{
				Name: metaName,
				ClientConfig: admissionregistrationV1.WebhookClientConfig{
					URL:      &swc.Url,
					CABundle: caBundle,
				},
				Rules: []admissionregistrationV1.RuleWithOperations{
					{
						Operations: swc.Operations,
						Rule: admissionregistrationV1.Rule{
							APIGroups:   []string{"*"},
							APIVersions: []string{"*"},
							Resources:   []string{resourcePlural},
							Scope:       pontificate(admissionregistrationV1.NamespacedScope),
						},
					},
				},
				TimeoutSeconds:          &swc.Timeout,
				AdmissionReviewVersions: []string{"v1"},
				SideEffects:             pontificate(admissionregistrationV1.SideEffectClassNone),
			},
		},
	}
}
