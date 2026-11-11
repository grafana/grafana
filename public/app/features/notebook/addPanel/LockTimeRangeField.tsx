import { Controller, type Control } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Checkbox } from '@grafana/ui';

import { type AddPanelFormValues } from './addPanelForm';
import { describeCapturedTimeRange, type CapturedTimeRange } from './capturedTimeRange';

interface Props {
  control: Control<AddPanelFormValues>;
  /** One window per captured panel; a single one is named in the label. */
  capturedTimeRanges: CapturedTimeRange[];
  disabled: boolean;
}

export function LockTimeRangeField({ control, capturedTimeRanges, disabled }: Props) {
  const [onlyRange] = capturedTimeRanges;
  const single = capturedTimeRanges.length === 1;
  return (
    <Controller
      control={control}
      name="lockTimeRange"
      render={({ field: { value, onChange, ...field } }) => (
        <Checkbox
          {...field}
          id="add-panel-lock-time-range"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.checked)}
          label={
            single
              ? t('notebooks.add-panel.lock-time-range', 'Lock to {{range}}', {
                  range: describeCapturedTimeRange(onlyRange),
                  // The range is formatted dates, not markup, and escaping turns its separators into
                  // entities the reader can see.
                  interpolation: { escapeValue: false },
                })
              : t('notebooks.add-panel.lock-time-ranges', 'Lock panels to the time ranges they showed')
          }
          description={
            single
              ? t(
                  'notebooks.add-panel.lock-time-range-description',
                  'Keep this visualization on the window it was captured in. Unlocked, it follows the notebook time range.'
                )
              : t(
                  'notebooks.add-panel.lock-time-ranges-description',
                  'Keep each visualization on the window it was captured in. Unlocked, they follow the notebook time range.'
                )
          }
        />
      )}
    />
  );
}
