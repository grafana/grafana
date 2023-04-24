// Copyright 2023 Grafana Labs
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package grafanaplugin

import (
	common "github.com/grafana/grafana/packages/grafana-schema/src/common"
	"github.com/grafana/grafana/pkg/plugins/pfs"
)

// This file (with its sibling .cue files) implements pfs.GrafanaPlugin
pfs.GrafanaPlugin

composableKinds: DataSourceCfg: {
	maturity: "merged"

	lineage: {
		seqs: [
			{
				schemas: [
					{
						#LogGroup: {
							// ARN of the log group
							arn: string
							// Name of the log group
							name: string
							// AccountId of the log group
							accountId?: string
							// Label of the log group
							accountLabel?: string
						} @cuetsy(kind="interface")

						#AwsAuthType: "keys" |
							"credentials" |
							"default" |
							"ec2_iam_role" |
							// @deprecated use default
							"arn" @cuetsy(kind="enum", memberNames="Keys|Credentials|Default|EC2IAMRole|ARN")

						#AwsAuthDataSourceJsonData: {
							common.DataSourceJsonData
							authType?: #AwsAuthType
							// ARN of the role to assume
							assumeRoleArn?: string
							externalId?:    string
							profile?:       string
							// Default AWS region to use
							defaultRegion?: string
							endpoint?:      string
						}

						Options: {
							#AwsAuthDataSourceJsonData
							timeField?:               string
							database?:                string
							customMetricsNamespaces?: string
							endpoint?:                string
							// Time string like 15s, 10m etc, see rangeUtils.intervalToMs.
							logsTimeout?: string
							// Used to create links if logs contain traceId.
							tracingDatasourceUid?: string
							logGroups?: [...#LogGroup]
							// @deprecated use logGroups
							defaultLogGroups?: [...string]
						}
					},
				]
			},
		]
	}
}
