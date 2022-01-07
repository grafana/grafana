import React, { useCallback, useState } from 'react';
import { pick } from 'lodash';

import { SelectableValue } from '@grafana/data';
import { Button, ConfirmModal, RadioButtonGroup } from '@grafana/ui';
import { EditorHeader, InlineSelect, FlexItem } from '@grafana/experimental';

import { CloudWatchDatasource } from '../datasource';
import {
  CloudWatchMetricsQuery,
  CloudWatchQuery,
  CloudWatchQueryMode,
  MetricEditorMode,
  MetricQueryType,
} from '../types';
import { useRegions } from '../hooks';

interface QueryHeaderProps {
  query: CloudWatchMetricsQuery;
  datasource: CloudWatchDatasource;
  onChange: (query: CloudWatchQuery) => void;
  onRunQuery: () => void;
  sqlCodeEditorIsDirty: boolean;
}

const apiModes: Array<SelectableValue<CloudWatchQueryMode>> = [
  { label: 'CloudWatch Metrics', value: 'Metrics' },
  { label: 'CloudWatch Logs', value: 'Logs' },
];

const metricEditorModes: Array<SelectableValue<MetricQueryType>> = [
  { label: 'Metric Search', value: MetricQueryType.Search },
  { label: 'Metric Query', value: MetricQueryType.Query },
];

const editorModes = [
  { label: 'Builder', value: MetricEditorMode.Builder },
  { label: 'Code', value: MetricEditorMode.Code },
];

const QueryHeader: React.FC<QueryHeaderProps> = ({ query, sqlCodeEditorIsDirty, datasource, onChange, onRunQuery }) => {
  const { metricEditorMode, metricQueryType, queryMode, region } = query;
  const [showConfirm, setShowConfirm] = useState(false);

  const [regions, regionIsLoading] = useRegions(datasource);

  const onEditorModeChange = useCallback(
    (newMetricEditorMode: MetricEditorMode) => {
      if (
        sqlCodeEditorIsDirty &&
        metricQueryType === MetricQueryType.Query &&
        metricEditorMode === MetricEditorMode.Code
      ) {
        setShowConfirm(true);
        return;
      }
      onChange({ ...query, metricEditorMode: newMetricEditorMode });
    },
    [setShowConfirm, onChange, sqlCodeEditorIsDirty, query, metricEditorMode, metricQueryType]
  );

  const onQueryModeChange = ({ value }: SelectableValue<CloudWatchQueryMode>) => {
    if (value !== queryMode) {
      const commonProps = pick(query, 'id', 'region', 'namespace', 'refId', 'hide', 'key', 'queryType', 'datasource');

      onChange({
        ...commonProps,
        queryMode: value,
      });
    }
  };

  return (
    <EditorHeader>
      <InlineSelect
        label="Region"
        value={regions.find((v) => v.value === region)}
        placeholder="Select region"
        allowCustomValue
        onChange={({ value: region }) => region && onChange({ ...query, region: region })}
        options={regions}
        isLoading={regionIsLoading}
      />

      <InlineSelect aria-label="Query mode" value={queryMode} options={apiModes} onChange={onQueryModeChange} />

      <InlineSelect
        aria-label="Metric editor mode"
        value={metricEditorModes.find((m) => m.value === metricQueryType)}
        options={metricEditorModes}
        onChange={({ value }) => {
          onChange({ ...query, metricQueryType: value });
        }}
      />

      <FlexItem grow={1} />

      <RadioButtonGroup options={editorModes} size="sm" value={metricEditorMode} onChange={onEditorModeChange} />

      {query.metricQueryType === MetricQueryType.Query && query.metricEditorMode === MetricEditorMode.Code && (
        <Button variant="secondary" size="sm" onClick={() => onRunQuery()}>
          Run query
        </Button>
      )}

      <ConfirmModal
        isOpen={showConfirm}
        title="Are you sure?"
        body="You will lose manual changes done to the query if you go back to the visual builder."
        confirmText="Yes, I am sure."
        dismissText="No, continue editing the query manually."
        icon="exclamation-triangle"
        onConfirm={() => {
          setShowConfirm(false);
          onChange({ ...query, metricEditorMode: MetricEditorMode.Builder });
        }}
        onDismiss={() => setShowConfirm(false)}
      />
    </EditorHeader>
  );
};

export default QueryHeader;
