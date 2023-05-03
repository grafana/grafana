import React from 'react';

import { CoreApp, LoadingState, QueryEditorProps, SelectableValue } from '@grafana/data';
import { EditorHeader, InlineSelect, FlexItem } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Badge, Button } from '@grafana/ui';

import { CloudWatchDatasource } from '../datasource';
import { DEFAULT_LOGS_QUERY_STRING } from '../defaultQueries';
import { isCloudWatchLogsQuery, isCloudWatchMetricsQuery } from '../guards';
import { useIsMonitoringAccount, useRegions } from '../hooks';
import { CloudWatchJsonData, CloudWatchQuery, CloudWatchQueryMode, MetricQueryType } from '../types';

export interface Props extends QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData> {
  extraHeaderElementLeft?: JSX.Element;
  extraHeaderElementRight?: JSX.Element;
  dataIsStale: boolean;
}

const apiModes: Array<SelectableValue<CloudWatchQueryMode>> = [
  { label: 'CloudWatch Metrics', value: 'Metrics' },
  { label: 'CloudWatch Logs', value: 'Logs' },
];

const QueryHeader = ({
  query,
  onChange,
  datasource,
  extraHeaderElementLeft,
  extraHeaderElementRight,
  dataIsStale,
  data,
  onRunQuery,
}: Props) => {
  const { queryMode, region } = query;
  const isMonitoringAccount = useIsMonitoringAccount(datasource.resources, query.region);
  const [regions, regionIsLoading] = useRegions(datasource);
  const emptyLogsExpression = isCloudWatchLogsQuery(query) ? !query.expression : false;

  const onQueryModeChange = ({ value }: SelectableValue<CloudWatchQueryMode>) => {
    if (value && value !== queryMode) {
      // reset expression to a default string when the query mode changes
      let expression = '';
      if (value === 'Logs') {
        expression = DEFAULT_LOGS_QUERY_STRING;
      }
      onChange({
        ...datasource.getDefaultQuery(CoreApp.Unknown),
        ...query,
        expression,
        queryMode: value,
      });
    }
  };
  const onRegionChange = async (region: string) => {
    if (config.featureToggles.cloudWatchCrossAccountQuerying && isCloudWatchMetricsQuery(query)) {
      const isMonitoringAccount = await datasource.resources.isMonitoringAccount(region);
      onChange({ ...query, region, accountId: isMonitoringAccount ? query.accountId : undefined });
    } else {
      onChange({ ...query, region });
    }
  };

  const shouldDisplayMonitoringBadge =
    config.featureToggles.cloudWatchCrossAccountQuerying &&
    isMonitoringAccount &&
    (query.queryMode === 'Logs' ||
      (isCloudWatchMetricsQuery(query) && query.metricQueryType === MetricQueryType.Search));

  return (
    <>
      <EditorHeader>
        <InlineSelect
          label="Region"
          value={region}
          placeholder="Select region"
          allowCustomValue
          onChange={({ value: region }) => region && onRegionChange(region)}
          options={regions}
          isLoading={regionIsLoading}
        />

        <InlineSelect
          aria-label="Query mode"
          value={queryMode}
          options={apiModes}
          onChange={onQueryModeChange}
          inputId={`cloudwatch-query-mode-${query.refId}`}
          id={`cloudwatch-query-mode-${query.refId}`}
        />

        {extraHeaderElementLeft}

        <FlexItem grow={1} />

        {shouldDisplayMonitoringBadge && (
          <>
            <Badge
              text="Monitoring account"
              color="blue"
              tooltip="AWS monitoring accounts view data from source accounts so you can centralize monitoring and troubleshoot activites"
            ></Badge>
          </>
        )}

        <Button
          variant={dataIsStale ? 'primary' : 'secondary'}
          size="sm"
          onClick={onRunQuery}
          icon={data?.state === LoadingState.Loading ? 'fa fa-spinner' : undefined}
          disabled={data?.state === LoadingState.Loading || emptyLogsExpression}
        >
          Run queries
        </Button>

        {extraHeaderElementRight}
      </EditorHeader>
    </>
  );
};

export default QueryHeader;
