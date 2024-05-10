package receiver

import (
	"encoding/json"
	"sort"
	"strings"

	"golang.org/x/exp/maps"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	notifications "github.com/grafana/grafana/pkg/apis/alerting/notifications/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/util"
)

func convertToK8sResources(orgID int64, recvs []definitions.GettableApiReceiver, namespacer request.NamespaceMapper) *notifications.ReceiverList {
	result := &notifications.ReceiverList{}
	for _, recv := range recvs {
		result.Items = append(result.Items, *convertToK8sResource(orgID, recv, namespacer))
	}
	return result
}

func convertToK8sResource(orgID int64, recv definitions.GettableApiReceiver, namespacer request.NamespaceMapper) *notifications.Receiver {
	integrations := make([]notifications.ReceiverIntegration, 0, len(recv.GrafanaManagedReceivers))
	provenances := map[string]struct{}{}
	for _, integration := range recv.GrafanaManagedReceivers {
		spec := notifications.ReceiverIntegration{
			DisableResolveMessage: util.Pointer(integration.DisableResolveMessage),
			Settings:              json.RawMessage(integration.Settings),
			Type:                  integration.Type,
			Uid:                   util.Pointer(integration.UID),
		}
		if integration.Provenance != "" {
			provenances[string(integration.Provenance)] = struct{}{}
		}
		integrations = append(integrations, spec)
	}

	p := maps.Keys(provenances)
	sort.Strings(p)
	return &notifications.Receiver{
		TypeMeta: resourceInfo.TypeMeta(),
		ObjectMeta: metav1.ObjectMeta{
			Name:      recv.Name,
			Namespace: namespacer(orgID),
			Annotations: map[string]string{ // TODO find a better place for provenance?
				"grafana.com/provenance": strings.Join(p, ","),
			},
			// // TODO ResourceVersion and CreationTimestamp
		},
		Spec: notifications.ReceiverSpec{Integrations: integrations},
	}
}

// func convertToDomainModel(recv *notifications.Receiver) definitions.PostableApiReceiver {
// 	recvs := make([]*definition.PostableGrafanaReceiver, 0, len(recv.Spec.Integrations))
// 	for _, integration := range recv.Spec.Integrations {
// 		grafrecv := &definitions.PostableGrafanaReceiver{
// 			Name:     recv.Name,
// 			Type:     integration.Type,
// 			Settings: definitions.RawMessage(integration.Settings),
// 		}
// 		if integration.Uid != nil {
// 			grafrecv.UID = *integration.Uid
// 		}
// 		if integration.DisableResolveMessage != nil {
// 			grafrecv.DisableResolveMessage = *integration.DisableResolveMessage
// 		}
// 		recvs = append(recvs, grafrecv)
// 	}
// 	return definitions.PostableApiReceiver{
// 		Receiver: config.Receiver{
// 			Name: recv.Name,
// 		},
// 		PostableGrafanaReceivers: definition.PostableGrafanaReceivers{
// 			GrafanaManagedReceivers: recvs,
// 		},
// 	}
// }
