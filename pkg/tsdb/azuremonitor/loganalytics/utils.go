package loganalytics

import (
	"fmt"

	"github.com/grafana/grafana-azure-sdk-go/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func AddConfigLinks(frame data.Frame, dl string) data.Frame {
	for i := range frame.Fields {
		if frame.Fields[i].Config == nil {
			frame.Fields[i].Config = &data.FieldConfig{}
		}
		deepLink := data.DataLink{
			Title:       "View in Azure Portal",
			TargetBlank: true,
			URL:         dl,
		}
		frame.Fields[i].Config.Links = append(frame.Fields[i].Config.Links, deepLink)
	}
	return frame
}

func GetAzurePortalUrl(azureCloud string) (string, error) {
	switch azureCloud {
	case azsettings.AzurePublic:
		return "https://portal.azure.com", nil
	case azsettings.AzureChina:
		return "https://portal.azure.cn", nil
	case azsettings.AzureUSGovernment:
		return "https://portal.azure.us", nil
	default:
		return "", fmt.Errorf("the cloud is not supported")
	}
}
