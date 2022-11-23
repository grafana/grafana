import React, { useCallback, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { FlexItem, InlineSelect } from '@grafana/experimental';
import { Button, ConfirmModal, RadioButtonGroup } from '@grafana/ui';

import { CloudWatchDatasource } from '../../datasource';
import { CloudWatchMetricsQuery, CloudWatchQuery, MetricEditorMode, MetricQueryType } from '../../types';

interface MetricsQueryHeaderProps {
  query: CloudWatchMetricsQuery;
  datasource: CloudWatchDatasource;
  onChange: (query: CloudWatchQuery) => void;
  onRunQuery: () => void;
  sqlCodeEditorIsDirty: boolean;
}

const metricEditorModes: Array<SelectableValue<MetricQueryType>> = [
  { label: 'Metric Search', value: MetricQueryType.Search },
  { label: 'Metric Query', value: MetricQueryType.Query },
];

const editorModes = [
  { label: 'Builder', value: MetricEditorMode.Builder },
  { label: 'Code', value: MetricEditorMode.Code },
];

const MetricsQueryHeader: React.FC<MetricsQueryHeaderProps> = ({
  query,
  sqlCodeEditorIsDirty,
  onChange,
  onRunQuery,
}) => {
  const { metricEditorMode, metricQueryType } = query;
  const [showConfirm, setShowConfirm] = useState(false);

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

  return (
    <>
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
    </>
  );
};

export default MetricsQueryHeader;
