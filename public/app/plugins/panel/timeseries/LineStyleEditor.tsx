import React, { useMemo } from 'react';

import { FieldOverrideEditorProps, SelectableValue } from '@grafana/data';
import { LineStyle } from '@grafana/schema';
import { HorizontalGroup, IconButton, RadioButtonGroup, Select } from '@grafana/ui';

type LineFill = 'solid' | 'dash' | 'dot';

const lineFillOptions: Array<SelectableValue<LineFill>> = [
  {
    label: 'Solid',
    value: 'solid',
  },
  {
    label: 'Dash',
    value: 'dash',
  },
  {
    label: 'Dots',
    value: 'dot',
  },
];

const dashOptions: Array<SelectableValue<string>> = [
  '10, 10', // default
  '10, 15',
  '10, 20',
  '10, 25',
  '10, 30',
  '10, 40',
  '15, 10',
  '20, 10',
  '25, 10',
  '30, 10',
  '40, 10',
  '50, 10',
  '5, 10',
  '30, 3, 3',
].map((txt) => ({
  label: txt,
  value: txt,
}));

const dotOptions: Array<SelectableValue<string>> = [
  '0, 10', // default
  '0, 20',
  '0, 30',
  '0, 40',
  '0, 3, 3',
].map((txt) => ({
  label: txt,
  value: txt,
}));

export const LineStyleEditor: React.FC<FieldOverrideEditorProps<LineStyle, any>> = ({ value, onChange }) => {
  const options = useMemo(() => (value?.fill === 'dash' ? dashOptions : dotOptions), [value]);
  const current = useMemo(() => {
    if (!value?.dash?.length) {
      return options[0];
    }
    const str = value.dash?.join(', ');
    const val = options.find((o) => o.value === str);
    if (!val) {
      return {
        label: str,
        value: str,
      };
    }
    return val;
  }, [value, options]);

  return (
    <HorizontalGroup>
      <RadioButtonGroup
        value={value?.fill || 'solid'}
        options={lineFillOptions}
        onChange={(v) => {
          let dash: number[] | undefined = undefined;
          if (v === 'dot') {
            dash = parseText(dotOptions[0].value!);
          } else if (v === 'dash') {
            dash = parseText(dashOptions[0].value!);
          }
          onChange({
            ...value,
            fill: v!,
            dash,
          });
        }}
      />
      {value?.fill && value?.fill !== 'solid' && (
        <>
          <Select
            allowCustomValue={true}
            options={options}
            value={current}
            width={20}
            onChange={(v) => {
              onChange({
                ...value,
                dash: parseText(v.value ?? ''),
              });
            }}
            formatCreateLabel={(t) => `Segments: ${parseText(t).join(', ')}`}
          />
          <div>
            &nbsp;
            <a
              title="The input expects a segment list"
              href="https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/setLineDash#Parameters"
              target="_blank"
              rel="noreferrer"
            >
              <IconButton name="question-circle" />
            </a>
          </div>
        </>
      )}
    </HorizontalGroup>
  );
};

function parseText(txt: string): number[] {
  const segments: number[] = [];
  for (const s of txt.split(/(?:,| )+/)) {
    const num = Number.parseInt(s, 10);
    if (!isNaN(num)) {
      segments.push(num);
    }
  }
  return segments;
}
