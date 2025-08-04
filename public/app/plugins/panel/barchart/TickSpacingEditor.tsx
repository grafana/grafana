import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Checkbox, HorizontalGroup, RadioButtonGroup, Tooltip } from '@grafana/ui';

export const TickSpacingEditor = (props: StandardEditorProps<number>) => {
  const GAPS_OPTIONS: Array<SelectableValue<number>> = [
    {
      label: t('barchart.tick-spacing-editor.gaps-options.label-none', 'None'),
      value: 0,
      description: t('barchart.tick-spacing-editor.gaps-options.description-none', 'Show all tick marks'),
    },
    {
      label: t('barchart.tick-spacing-editor.gaps-options.label-small', 'Small'),
      value: 100,
      description: t('barchart.tick-spacing-editor.gaps-options.description-small', 'Require {{spacing}} spacing', {
        spacing: '100px',
      }),
    },
    {
      label: t('barchart.tick-spacing-editor.gaps-options.label-medium', 'Medium'),
      value: 200,
      description: t('barchart.tick-spacing-editor.gaps-options.description-medium', 'Require {{spacing}} spacing', {
        spacing: '200px',
      }),
    },
    {
      label: t('barchart.tick-spacing-editor.gaps-options.label-large', 'Large'),
      value: 300,
      description: t('barchart.tick-spacing-editor.gaps-options.description-large', 'Require {{spacing}} spacing', {
        spacing: '300px',
      }),
    },
  ];
  let value = props.value ?? 0;
  const isRTL = value < 0;
  if (isRTL) {
    value *= -1;
  }
  let gap = GAPS_OPTIONS[0];
  for (const v of GAPS_OPTIONS) {
    gap = v;
    if (value <= gap.value!) {
      break;
    }
  }

  const onSpacingChange = (val: number) => {
    props.onChange(val * (isRTL ? -1 : 1));
  };

  const onRTLChange = () => {
    props.onChange(props.value * -1);
  };

  return (
    <HorizontalGroup>
      <RadioButtonGroup value={gap.value} options={GAPS_OPTIONS} onChange={onSpacingChange} />
      {value !== 0 && (
        <Tooltip
          content={t(
            'barchart.tick-spacing-editor.content-require-space-from-the-right-side',
            'Require space from the right side'
          )}
          placement="top"
        >
          <div>
            <Checkbox value={isRTL} onChange={onRTLChange} label={t('barchart.tick-spacing-editor.label-rtl', 'RTL')} />
          </div>
        </Tooltip>
      )}
    </HorizontalGroup>
  );
};
