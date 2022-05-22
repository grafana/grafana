import React, { ChangeEvent } from 'react';

import { DataFrameType, SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, InlineSwitch, Input, Select } from '@grafana/ui';

import { EditorProps } from '../QueryEditor';
import { HeatmapQuery } from '../types';

const formats = [
  { value: DataFrameType.TimeSeriesWide, label: DataFrameType.TimeSeriesWide + ' (buckets}' },
  { value: DataFrameType.TimeSeriesMany, label: DataFrameType.TimeSeriesMany + ' (buckets}' },
  { value: DataFrameType.HeatmapScanlines, label: DataFrameType.HeatmapScanlines },
  { value: DataFrameType.HeatmapSparse, label: DataFrameType.HeatmapSparse },
];

const scales = [
  { value: 'linear', label: 'linear' },
  { value: 'log2', label: 'Exponential' },
  { value: 'alpha', label: 'Alpha' },
];

export const HeatmapQueryEditor = ({ onChange, query }: EditorProps) => {
  const heatmap = query.heatmap ?? ({} as HeatmapQuery);

  const onUpdate = (heatmap: HeatmapQuery) => {
    onChange({ ...query, heatmap });
  };

  const onFormatChange = (v: SelectableValue<string>) => {
    onUpdate({ ...heatmap, format: v.value as any });
  };

  const onScaleChange = (v: SelectableValue<string>) => {
    onUpdate({ ...heatmap, scale: v.value as any });
  };

  const onToggleExemplars = () => {
    onUpdate({ ...heatmap, exemplars: !Boolean(heatmap.exemplars) });
  };
  const onToggleFrameType = () => {
    onUpdate({ ...heatmap, setFrameType: !Boolean(heatmap.setFrameType) });
  };
  const onToggleNumericX = () => {
    onUpdate({ ...heatmap, numericX: !Boolean(heatmap.numericX) });
  };

  const onNameAsLabelChange = (e: ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...heatmap, nameAsLabel: e.target.value });
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField labelWidth={14} label="Format">
          <Select
            options={formats}
            value={formats.find((v) => v.value === heatmap.format) ?? formats[0]}
            onChange={onFormatChange}
          />
        </InlineField>
        <InlineField label="Scale">
          <Select
            options={scales}
            value={scales.find((v) => v.value === heatmap.scale) ?? scales[0]}
            onChange={onScaleChange}
          />
        </InlineField>
        {heatmap.format?.startsWith('timeseries-') && (
          <InlineField label="As Label" tooltip="the name should be a lable">
            <Input
              value={heatmap.nameAsLabel ?? ''}
              placeholder={`ie: 'le'`}
              width={12}
              onChange={onNameAsLabelChange}
            />
          </InlineField>
        )}
      </InlineFieldRow>

      <InlineFieldRow>
        <InlineField labelWidth={14} label="Exemplars" tooltip="add an exemplars response">
          <InlineSwitch value={Boolean(heatmap.exemplars)} onChange={onToggleExemplars} />
        </InlineField>
        <InlineField label="Set frame type" tooltip="include frameType in the response metadata">
          <InlineSwitch value={Boolean(heatmap.setFrameType)} onChange={onToggleFrameType} />
        </InlineField>
        <InlineField label="Numeric X" tooltip="use a numeric value for X axis">
          <InlineSwitch value={Boolean(heatmap.numericX)} onChange={onToggleNumericX} />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};
