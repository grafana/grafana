package constants

import "github.com/grafana/grafana-aws-sdk/pkg/cloudWatchConsts"

// NamespaceMetricsMap is a map of Cloudwatch namespaces to their metrics
// Deprecated: use cloudWatchConsts.NamespaceMetricsMap from grafana-aws-sdk instead
var NamespaceMetricsMap = cloudWatchConsts.NamespaceMetricsMap

// NamespaceDimensionKeysMap is a map of CloudWatch namespaces to their dimension keys
// Deprecated: use cloudWatchConsts.NamespaceDimensionKeysMap from grafana-aws-sdk instead
var NamespaceDimensionKeysMap = cloudWatchConsts.NamespaceDimensionKeysMap

type RegionsSet map[string]struct{}

func Regions() RegionsSet {
	return RegionsSet{
		"af-south-1":     {},
		"ap-east-1":      {},
		"ap-northeast-1": {},
		"ap-northeast-2": {},
		"ap-northeast-3": {},
		"ap-south-1":     {},
		"ap-south-2":     {},
		"ap-southeast-1": {},
		"ap-southeast-2": {},
		"ap-southeast-3": {},
		"ap-southeast-4": {},
		"ca-central-1":   {},
		"cn-north-1":     {},
		"cn-northwest-1": {},
		"eu-central-1":   {},
		"eu-central-2":   {},
		"eu-north-1":     {},
		"eu-south-1":     {},
		"eu-south-2":     {},
		"eu-west-1":      {},
		"eu-west-2":      {},
		"eu-west-3":      {},
		"il-central-1":   {},
		"me-central-1":   {},
		"me-south-1":     {},
		"sa-east-1":      {},
		"us-east-1":      {},
		"us-east-2":      {},
		"us-gov-east-1":  {},
		"us-gov-west-1":  {},
		"us-iso-east-1":  {},
		"us-isob-east-1": {},
		"us-west-1":      {},
		"us-west-2":      {},
	}
}
