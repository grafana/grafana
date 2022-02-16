import React, { useRef } from 'react';
import { EditorField } from '@grafana/experimental';
import { SelectableValue } from '@grafana/data';
import { Input, Select } from '@grafana/ui';
import { LegendFormatMode, PromQuery } from '../../types';

export interface Props {
  query: PromQuery;
  onChange: (update: PromQuery) => void;
  onRunQuery: () => void;
}

const legendModeOptions = [
  {
    label: 'Auto',
    value: LegendFormatMode.Auto,
    description: 'Only includes unique labels',
  },
  { label: 'Verbose', value: LegendFormatMode.Verbose, description: 'All label names and values' },
  { label: 'Custom', value: LegendFormatMode.Custom, description: 'Provide a naming template' },
];

/**
 * Tests for this component are on the parent level (PromQueryBuilderOptions).
 */
export const PromQueryLegendEditor = React.memo<Props>(({ query, onChange, onRunQuery }) => {
  const mode = getLegendMode(query.legendFormat);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onLegendFormatChanged = (evt: React.FocusEvent<HTMLInputElement>) => {
    let legendFormat = evt.currentTarget.value;
    if (legendFormat.length === 0) {
      legendFormat = LegendFormatMode.Auto;
    }
    onChange({ ...query, legendFormat });
    onRunQuery();
  };

  const onLegendModeChanged = (value: SelectableValue<LegendFormatMode>) => {
    switch (value.value!) {
      case LegendFormatMode.Auto:
        onChange({ ...query, legendFormat: LegendFormatMode.Auto });
        break;
      case LegendFormatMode.Custom:
        onChange({ ...query, legendFormat: '{{label_name}}' });
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.setSelectionRange(2, 12, 'forward');
        }, 10);
        break;
      case LegendFormatMode.Verbose:
        onChange({ ...query, legendFormat: '' });
        break;
    }
    onRunQuery();
  };

  return (
    <EditorField
      label="Legend"
      tooltip="Series name override or template. Ex. {{hostname}} will be replaced with label value for hostname."
    >
      <>
        {mode === LegendFormatMode.Custom && (
          <Input
            id="legendFormat"
            width={22}
            placeholder="auto"
            defaultValue={query.legendFormat}
            onBlur={onLegendFormatChanged}
            ref={inputRef}
          />
        )}
        {mode !== LegendFormatMode.Custom && (
          <Select
            inputId="legend.mode"
            isSearchable={false}
            placeholder="Select legend mode"
            options={legendModeOptions}
            width={22}
            onChange={onLegendModeChanged}
            value={legendModeOptions.find((x) => x.value === mode)}
          />
        )}
      </>
    </EditorField>
  );
});

PromQueryLegendEditor.displayName = 'PromQueryLegendEditor';

function getLegendMode(legendFormat: string | undefined) {
  // This special value means the new smart minimal series naming
  if (legendFormat === LegendFormatMode.Auto) {
    return LegendFormatMode.Auto;
  }

  // Missing or empty legend format is the old verbose behavior
  if (legendFormat == null || legendFormat === '') {
    return LegendFormatMode.Verbose;
  }

  return LegendFormatMode.Custom;
}

export function getLegendModeLabel(legendFormat: string | undefined) {
  const mode = getLegendMode(legendFormat);
  if (mode !== LegendFormatMode.Custom) {
    return legendModeOptions.find((x) => x.value === mode)?.label;
  }
  return legendFormat;
}
