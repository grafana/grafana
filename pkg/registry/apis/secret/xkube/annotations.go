package xkube

import "github.com/grafana/grafana/pkg/apimachinery/utils"

var (
	// Exclude these annotations
	skipAnnotations = map[string]bool{
		"kubectl.kubernetes.io/last-applied-configuration": true, // force server side apply
		utils.AnnoKeyCreatedBy:                             true,
		utils.AnnoKeyUpdatedBy:                             true,
		utils.AnnoKeyUpdatedTimestamp:                      true,
	}
)

func CleanAnnotations(anno map[string]string) map[string]string {
	copy := make(map[string]string)
	for k, v := range anno {
		if skipAnnotations[k] {
			continue
		}
		copy[k] = v
	}
	return copy
}
