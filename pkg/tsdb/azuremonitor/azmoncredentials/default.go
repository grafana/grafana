package azmoncredentials

import (
	"github.com/grafana/grafana-azure-sdk-go/v2/azcredentials"
	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
)

func GetDefaultCredentials(settings *azsettings.AzureSettings) azcredentials.AzureCredentials {
	if settings.ManagedIdentityEnabled {
		return &azcredentials.AzureManagedIdentityCredentials{}
	} else if settings.WorkloadIdentityEnabled {
		return &azcredentials.AzureWorkloadIdentityCredentials{}
	} else {
		return &azcredentials.AzureClientSecretCredentials{AzureCloud: settings.GetDefaultCloud()}
	}
}
