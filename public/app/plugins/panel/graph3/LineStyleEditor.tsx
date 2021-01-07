import React, { useMemo } from 'react';
import { FieldOverrideEditorProps, SelectableValue } from '@grafana/data';
import { HorizontalGroup, IconButton, LineStyle, RadioButtonGroup, Select } from '@grafana/ui';

type LineFill = 'solid' | 'dash' | 'dot';

const lineFillOptions: Array<SelectableValue<lineFill>> = [
  {
    label: 'Solid',
    value: 'solid',
  },
  {
    label: 'Dash',
    value: 'dash',
  },
  // {
  //   label: 'Dots',
  //   value: 'dot',
  // },
];

const SPACKING_DASH: Array<SelectableValue<string>> = [
  '10, 10', // default
  '20, 5',
  '20, 5',
  '15, 3, 3, 3',
  '20, 3, 3, 3, 3, 3, 3, 3',
  '12, 3, 3',
].map(txt => ({
  label: txt,
  value: txt,
}));

const SPACKING_DOTS: Array<SelectableValue<string>> = [
  '0, 10', // default
  '10, 20, 0, 20',
  '0, 20',
  '0, 30',
  '0, 3, 3, 3',
].map(txt => ({
  label: txt,
  value: txt,
}));

export const LineStyleEditor: React.FC<FieldOverrideEditorProps<LineStyle, any>> = ({ value, onChange }) => {
  const options = useMemo(() => (value?.fill === 'dash' ? SPACKING_DASH : SPACKING_DOTS), [value]);
  const current = useMemo(() => {
    if (!value?.dash?.length) {
      return options[0];
    }
    const str = value.dash?.join(', ');
    const val = options.find(o => o.value === str);
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
        options={LINE_OPTIONS}
        onChange={v => {
          onChange({
            ...value,
            fill: v!,
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
            onChange={v => {
              onChange({
                ...value,
                dash: parseText(v.value ?? ''),
              });
            }}
            formatCreateLabel={t => `Segments: ${parseText(t).join(', ')}`}
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
