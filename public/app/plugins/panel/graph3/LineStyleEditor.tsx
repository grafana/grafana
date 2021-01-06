import React, { useMemo } from 'react';
import { FieldOverrideEditorProps, SelectableValue } from '@grafana/data';
import { HorizontalGroup, IconButton, LineStyle, LinkButton, RadioButtonGroup, Select } from '@grafana/ui';

type lineFill = 'solid' | 'dash' | 'dot';

const LINE_OPTIONS: Array<SelectableValue<lineFill>> = [
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

const SPACING_OPTIONS: Array<SelectableValue<string>> = [
  {
    label: 'Standard',
    value: '10 10',
  },
];

export const LineStyleEditor: React.FC<FieldOverrideEditorProps<LineStyle, any>> = ({ value, onChange }) => {
  const dash = useMemo(() => {
    if (value?.dash?.length) {
      return value.dash.join(' ');
    }
    return undefined;
  }, [value]);

  return (
    <HorizontalGroup>
      <RadioButtonGroup
        value={value?.fill || 'solid'}
        options={LINE_OPTIONS}
        onChange={v => {
          console.log(v, value);
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
            options={SPACING_OPTIONS}
            value={dash}
            width={20}
            onChange={v => {
              console.log('SPACING', v);
            }}
            formatCreateLabel={t => `Segments: ${t}`}
          />
          <LinkButton
            title="The input expects a segment list"
            href="https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/setLineDash#Parameters"
            target="_blank"
            icon="question-circle"
          />
        </>
      )}
    </HorizontalGroup>
  );
};
