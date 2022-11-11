import { pick } from 'lodash';
import React from 'react';

import { SelectableValue, ExploreMode } from '@grafana/data';
import { EditorHeader, InlineSelect } from '@grafana/experimental';

import { CloudWatchDatasource } from '../datasource';
import { useRegions } from '../hooks';
import { CloudWatchQuery, CloudWatchQueryMode } from '../types';

import MetricsQueryHeader from './MetricsQueryEditor/MetricsQueryHeader';

interface QueryHeaderProps {
  query: CloudWatchQuery;
  datasource: CloudWatchDatasource;
  onChange: (query: CloudWatchQuery) => void;
  onRunQuery: () => void;
  sqlCodeEditorIsDirty: boolean;
  onRegionChange?: (region: string) => Promise<void>;
}

const apiModes: Array<SelectableValue<CloudWatchQueryMode>> = [
  { label: 'CloudWatch Metrics', value: 'Metrics' },
  { label: 'CloudWatch Logs', value: 'Logs' },
];

const QueryHeader: React.FC<QueryHeaderProps> = ({ query, sqlCodeEditorIsDirty, datasource, onChange, onRunQuery }) => {
  const { queryMode, region } = query;

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

  const onRegion = async ({ value }: SelectableValue<string>) => {
    onChange({
      ...query,
      region: value,
    } as CloudWatchQuery);
  };

  return (
    <EditorHeader>
      <InlineSelect
        label="Region"
        value={region}
        placeholder="Select region"
        allowCustomValue
        onChange={({ value: region }) => region && onRegion({ value: region })}
        options={regions}
        isLoading={regionIsLoading}
      />

      <InlineSelect aria-label="Query mode" value={queryMode} options={apiModes} onChange={onQueryModeChange} />

      {queryMode === ExploreMode.Metrics && (
        <MetricsQueryHeader
          query={query}
          datasource={datasource}
          onChange={onChange}
          onRunQuery={onRunQuery}
          sqlCodeEditorIsDirty={sqlCodeEditorIsDirty}
        />
      )}
    </EditorHeader>
  );
};

export default QueryHeader;
