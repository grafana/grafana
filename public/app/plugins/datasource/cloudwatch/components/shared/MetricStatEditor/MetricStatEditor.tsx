import { useEffect } from 'react';
import * as React from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorRow, EditorRows, EditorSwitch } from '@grafana/plugin-ui';
import { config } from '@grafana/runtime';
import { Select, TextLink } from '@grafana/ui';

import { CloudWatchDatasource } from '../../../datasource';
import { useAccountOptions, useMetrics, useNamespaces } from '../../../hooks';
import { standardStatistics } from '../../../standardStatistics';
import { MetricStat } from '../../../types';
import { appendTemplateVariables, toOption } from '../../../utils/utils';
import { Account } from '../Account';
import { Dimensions } from '../Dimensions/Dimensions';

export type Props = {
  refId: string;
  metricStat: MetricStat;
  datasource: CloudWatchDatasource;
  disableExpressions?: boolean;
  onChange: (value: MetricStat) => void;
};

const percentileSyntaxRE = /^(p|tm|tc|ts|wm)\d{2}(?:\.\d{1,2})?$/;
const boundariesInnerParenthesesSyntax = `\\d*(\\.\\d+)?%?:\\d*(\\.\\d+)?%?`;
const boundariesSyntaxRE = new RegExp(`^(PR|TM|TC|TS|WM)\\((${boundariesInnerParenthesesSyntax})\\)$`);

// used in both Metric query editor and in Annotations Editor
export const MetricStatEditor = ({
  refId,
  metricStat,
  datasource,
  disableExpressions = false,
  onChange,
}: React.PropsWithChildren<Props>) => {
  const namespaces = useNamespaces(datasource);
  const metrics = useMetrics(datasource, metricStat);
  const accountState = useAccountOptions(datasource.resources, metricStat.region);

  useEffect(() => {
    datasource.resources.isMonitoringAccount(metricStat.region).then((isMonitoringAccount) => {
      if (isMonitoringAccount && !accountState.loading && accountState.value?.length && !metricStat.accountId) {
        onChange({ ...metricStat, accountId: 'all' });
      }

      if (!accountState.loading && accountState.value && !accountState.value.length && metricStat.accountId) {
        onChange({ ...metricStat, accountId: undefined });
      }
    });
  }, [accountState, metricStat, onChange, datasource.resources]);

  const onNamespaceChange = async (metricStat: MetricStat) => {
    const validatedQuery = await validateMetricName(metricStat);
    onChange(validatedQuery);
  };

  const validateMetricName = async (metricStat: MetricStat) => {
    let { metricName, namespace, region } = metricStat;
    if (!metricName) {
      return metricStat;
    }
    await datasource.resources.getMetrics({ namespace, region }).then((result: Array<SelectableValue<string>>) => {
      if (!result.find((metric) => metric.value === metricName)) {
        metricName = '';
      }
    });
    return { ...metricStat, metricName };
  };

  return (
    <EditorRows>
      <EditorRow>
        {!disableExpressions && config.featureToggles.cloudWatchCrossAccountQuerying && (
          <Account
            accountId={metricStat.accountId}
            onChange={(accountId?: string) => {
              onChange({ ...metricStat, accountId });
            }}
            accountOptions={accountState?.value || []}
          ></Account>
        )}
        <EditorFieldGroup>
          <EditorField label="Namespace" width={26}>
            <Select
              aria-label="Namespace"
              value={metricStat?.namespace && toOption(metricStat.namespace)}
              allowCustomValue
              options={namespaces}
              onChange={({ value: namespace }) => {
                if (namespace) {
                  onNamespaceChange({ ...metricStat, namespace });
                }
              }}
            />
          </EditorField>
          <EditorField label="Metric name" width={16}>
            <Select
              aria-label="Metric name"
              value={metricStat?.metricName && toOption(metricStat.metricName)}
              allowCustomValue
              options={metrics}
              onChange={({ value: metricName }) => {
                if (metricName) {
                  onChange({ ...metricStat, metricName });
                }
              }}
            />
          </EditorField>

          <EditorField label="Statistic" width={16}>
            <Select
              inputId={`${refId}-metric-stat-editor-select-statistic`}
              allowCustomValue
              value={toOption(metricStat.statistic ?? standardStatistics[0])}
              options={appendTemplateVariables(
                datasource,
                standardStatistics.filter((s) => s !== metricStat.statistic).map(toOption)
              )}
              onChange={({ value: statistic }) => {
                if (
                  !statistic ||
                  (!standardStatistics.includes(statistic) &&
                    !(percentileSyntaxRE.test(statistic) || boundariesSyntaxRE.test(statistic)) &&
                    !datasource.templateSrv.containsTemplate(statistic))
                ) {
                  return;
                }

                onChange({ ...metricStat, statistic });
              }}
            />
          </EditorField>
        </EditorFieldGroup>
      </EditorRow>

      <EditorRow>
        <EditorField label="Dimensions">
          <Dimensions
            metricStat={metricStat}
            onChange={(dimensions) => onChange({ ...metricStat, dimensions })}
            disableExpressions={disableExpressions}
            datasource={datasource}
          />
        </EditorField>
        {!disableExpressions && (
          <EditorField
            label="Match exact"
            optional={true}
            tooltip={
              <>
                {
                  'Only show metrics that contain exactly the dimensions defined in the query and match the specified values. If this is enabled, all dimensions of the metric being queried must be specified so that the '
                }
                <TextLink
                  href="https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/search-expression-syntax.html"
                  external
                >
                  metric schema
                </TextLink>
                {
                  ' matches exactly. If this is disabled, metrics that match the schema and have additional dimensions will also be returned.'
                }
              </>
            }
            tooltipInteractive
          >
            <EditorSwitch
              id={`${refId}-cloudwatch-match-exact`}
              value={!!metricStat.matchExact}
              onChange={(e) => {
                onChange({
                  ...metricStat,
                  matchExact: e.currentTarget.checked,
                });
              }}
            />
          </EditorField>
        )}
      </EditorRow>
    </EditorRows>
  );
};
