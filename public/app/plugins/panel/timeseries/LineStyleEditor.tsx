import { useMemo } from 'react';

import { StandardEditorProps, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { LineStyle } from '@grafana/schema';
import { IconButton, RadioButtonGroup, Select, Stack } from '@grafana/ui';

type LineFill = 'solid' | 'dash' | 'dot';

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

type Props = StandardEditorProps<LineStyle, unknown>;

export const LineStyleEditor = ({ value, onChange }: Props) => {
  const lineFillOptions: Array<SelectableValue<LineFill>> = [
    {
      label: t('timeseries.line-style-editor.line-fill-options.label-solid', 'Solid'),
      value: 'solid',
    },
    {
      label: t('timeseries.line-style-editor.line-fill-options.label-dash', 'Dash'),
      value: 'dash',
    },
    {
      label: t('timeseries.line-style-editor.line-fill-options.label-dots', 'Dots'),
      value: 'dot',
    },
  ];
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
    <Stack wrap={true} alignItems="flex-end">
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
              title={t(
                'timeseries.line-style-editor.title-the-input-expects-a-segment-list',
                'The input expects a segment list'
              )}
              href="https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/setLineDash#Parameters"
              target="_blank"
              rel="noreferrer"
            >
              <IconButton name="question-circle" tooltip={t('timeseries.line-style-editor.tooltip-help', 'Help')} />
            </a>
          </div>
        </>
      )}
    </Stack>
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
