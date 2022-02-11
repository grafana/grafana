import React, { useRef, useState } from 'react';
import { EditorField } from '@grafana/experimental';
import { SelectableValue } from '@grafana/data';
import { Input, Select } from '@grafana/ui';
import { PromQuery } from '../../types';

export interface Props {
  query: PromQuery;
  onChange: (update: PromQuery) => void;
  onRunQuery: () => void;
}

export enum LegendFormatMode {
  Auto = '__auto',
  Verbose = '__verbose',
  Custom = '__custom',
}

const legendOptions = [
  { label: 'Auto', value: LegendFormatMode.Auto },
  { label: 'Verbose', value: LegendFormatMode.Verbose },
  { label: 'Custom', value: LegendFormatMode.Custom },
];

export const PromQueryLegendEditor = React.memo<Props>(({ query, onChange, onRunQuery }) => {
  const [mode, setMode] = useState(getLegendMode(query.legendFormat));
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onLegendFormatChanged = (evt: React.FocusEvent<HTMLInputElement>) => {
    let legendFormat = evt.currentTarget.value;
    if (legendFormat.length === 0) {
      legendFormat = LegendFormatMode.Auto;
      setMode(LegendFormatMode.Auto);
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
    setMode(value.value!);
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
            width={20}
            placeholder="auto"
            defaultValue={query.legendFormat}
            onBlur={onLegendFormatChanged}
            ref={inputRef}
          />
        )}
        {mode !== LegendFormatMode.Custom && (
          <Select
            menuShouldPortal
            isSearchable={false}
            options={legendOptions}
            width={20}
            onChange={onLegendModeChanged}
            value={legendOptions.find((x) => x.value === mode)}
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
