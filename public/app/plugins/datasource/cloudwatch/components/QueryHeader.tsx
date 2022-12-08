import React from 'react';

import { LoadingState, QueryEditorProps, SelectableValue } from '@grafana/data';
import { EditorHeader, InlineSelect, FlexItem } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Badge, Button } from '@grafana/ui';

import { CloudWatchDatasource } from '../datasource';
import { isCloudWatchMetricsQuery } from '../guards';
import { useIsMonitoringAccount, useRegions } from '../hooks';
import { CloudWatchJsonData, CloudWatchQuery, CloudWatchQueryMode } from '../types';

export interface Props extends QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData> {
  leftHeaderElement?: JSX.Element;
  rightHeaderElement?: JSX.Element;
  dataIsStale: boolean;
}

const apiModes: Array<SelectableValue<CloudWatchQueryMode>> = [
  { label: 'CloudWatch Metrics', value: 'Metrics' },
  { label: 'CloudWatch Logs', value: 'Logs' },
];

const QueryHeader: React.FC<Props> = ({
  query,
  onChange,
  datasource,
  leftHeaderElement,
  rightHeaderElement,
  dataIsStale,
  data,
  onRunQuery,
}) => {
  const { queryMode, region } = query;
  const isMonitoringAccount = useIsMonitoringAccount(datasource.api, query.region);

  const [regions, regionIsLoading] = useRegions(datasource);

  const onQueryModeChange = ({ value }: SelectableValue<CloudWatchQueryMode>) => {
    if (value !== queryMode) {
      onChange({
        ...query,
        queryMode: value,
      } as CloudWatchQuery);
    }
  };
  const onRegionChange = async (region: string) => {
    if (config.featureToggles.cloudWatchCrossAccountQuerying && isCloudWatchMetricsQuery(query)) {
      const isMonitoringAccount = await datasource.api.isMonitoringAccount(region);
      onChange({ ...query, region, accountId: isMonitoringAccount ? query.accountId : undefined });
    } else {
      onChange({ ...query, region });
    }
  };

  const shouldDisplayMonitoringBadge = config.featureToggles.cloudWatchCrossAccountQuerying && isMonitoringAccount;

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

        <InlineSelect aria-label="Query mode" value={queryMode} options={apiModes} onChange={onQueryModeChange} />

        {leftHeaderElement}

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

        {rightHeaderElement}

        <Button
          variant={dataIsStale ? 'primary' : 'secondary'}
          size="sm"
          onClick={onRunQuery}
          icon={data?.state === LoadingState.Loading ? 'fa fa-spinner' : undefined}
          disabled={data?.state === LoadingState.Loading}
        >
          Run queries
        </Button>
      </EditorHeader>
    </>
  );
};

export default QueryHeader;
