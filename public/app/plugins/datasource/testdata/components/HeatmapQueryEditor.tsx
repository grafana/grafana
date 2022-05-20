import React from 'react';

import { SelectableValue } from '@grafana/data';
import { InlineField, InlineFieldRow, InlineSwitch, Select } from '@grafana/ui';

import { EditorProps } from '../QueryEditor';
import { HeatmapQuery } from '../types';

// format: 'fields-wide' | 'fields-many' | 'dense' | 'sparse',
// scale?: 'linear' | 'log10',
// exemplars?: boolean;
// setFrameType?: boolean;
// numericX?: boolean; // x does not need to be time

const formats = [
  { value: 'fields-wide', label: 'fields-wide' },
  { value: 'fields-many', label: 'fields-many' },
  { value: 'dense', label: 'dense' },
  { value: 'sparse', label: 'sparse' },
];

const scales = [
  { value: 'linear', label: 'linear' },
  { value: 'log10', label: 'Log(10)' },
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
  const onToggleNameAsLE = () => {
    onUpdate({ ...heatmap, nameAsLE: !Boolean(heatmap.nameAsLE) });
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
        {heatmap.format?.startsWith('fields-') && (
          <InlineField label="Name as LE" tooltip="the name should be a lable">
            <InlineSwitch value={Boolean(heatmap.nameAsLE)} onChange={onToggleNameAsLE} />
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
