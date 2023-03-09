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
		obj := convertShortWebhookToMutationWebhook(hook)
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

// Converts shortwebhookconfig into a validatingwebhookconfiguration
func convertShortWebhookToMutationWebhook(swc ShortWebhookConfig) *admissionregistrationV1.MutatingWebhookConfiguration {
	metaname := fmt.Sprintf("validation.%s.core.grafana.com", swc.Resource)

	return &admissionregistrationV1.MutatingWebhookConfiguration{
		TypeMeta: metav1.TypeMeta{
			Kind:       "MutatingWebhookConfiguration",
			APIVersion: "admissionregistration.k8s.io/v1",
		},
		ObjectMeta: metav1.ObjectMeta{Name: metaname},
		Webhooks: []admissionregistrationV1.MutatingWebhook{
			{
				Name: metaname,
				ClientConfig: admissionregistrationV1.WebhookClientConfig{
					URL:      &swc.Url,
					CABundle: caBundle,
				},
				Rules: []admissionregistrationV1.RuleWithOperations{
					{
						Operations: []admissionregistrationV1.OperationType{
							admissionregistrationV1.Create,
						},
						Rule: admissionregistrationV1.Rule{
							APIGroups:   []string{"*"},
							APIVersions: []string{"*"},
							Resources:   []string{swc.Resource},
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
