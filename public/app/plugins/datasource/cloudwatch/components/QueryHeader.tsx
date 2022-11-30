import { pick } from 'lodash';
import React from 'react';

import { SelectableValue, ExploreMode } from '@grafana/data';
import { EditorHeader, InlineSelect, FlexItem } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Badge } from '@grafana/ui';

import { CloudWatchDatasource } from '../datasource';
import { isCloudWatchMetricsQuery } from '../guards';
import { useIsMonitoringAccount, useRegions } from '../hooks';
import { CloudWatchQuery, CloudWatchQueryMode } from '../types';

import MetricsQueryHeader from './MetricsQueryEditor/MetricsQueryHeader';

interface QueryHeaderProps {
  query: CloudWatchQuery;
  datasource: CloudWatchDatasource;
  onChange: (query: CloudWatchQuery) => void;
  onRunQuery: () => void;
  sqlCodeEditorIsDirty: boolean;
}

const apiModes: Array<SelectableValue<CloudWatchQueryMode>> = [
  { label: 'CloudWatch Metrics', value: 'Metrics' },
  { label: 'CloudWatch Logs', value: 'Logs' },
];

const QueryHeader: React.FC<QueryHeaderProps> = ({ query, sqlCodeEditorIsDirty, datasource, onChange, onRunQuery }) => {
  const { queryMode, region } = query;
  const isMonitoringAccount = useIsMonitoringAccount(datasource.api, query.region);

  const [regions, regionIsLoading] = useRegions(datasource);

  const onQueryModeChange = ({ value }: SelectableValue<CloudWatchQueryMode>) => {
    if (value !== queryMode) {
      const commonProps = pick(query, 'id', 'region', 'namespace', 'refId', 'hide', 'key', 'queryType', 'datasource');
      onChange({
        ...commonProps,
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

  const shouldDisplayMonitoringBadge =
    queryMode === 'Logs' && isMonitoringAccount && config.featureToggles.cloudWatchCrossAccountQuerying;

  return (
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

      {shouldDisplayMonitoringBadge && (
        <>
          <FlexItem grow={1} />
          <Badge
            text="Monitoring account"
            color="blue"
            tooltip="AWS monitoring accounts view data from source accounts so you can centralize monitoring and troubleshoot activites"
          ></Badge>
        </>
      )}

      {queryMode === ExploreMode.Metrics && (
        <MetricsQueryHeader
          query={query}
          datasource={datasource}
          onChange={onChange}
          onRunQuery={onRunQuery}
          isMonitoringAccount={isMonitoringAccount}
          sqlCodeEditorIsDirty={sqlCodeEditorIsDirty}
        />
      )}
    </EditorHeader>
  );
};

export default QueryHeader;
