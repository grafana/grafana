import { Controller, type Control } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Checkbox } from '@grafana/ui';

import { type AddPanelFormValues } from './addPanelForm';
import { describeCapturedTimeRange, type CapturedTimeRange } from './capturedTimeRange';

interface Props {
  control: Control<AddPanelFormValues>;
  /** The window the visualization is being captured in, which the checkbox names and locks to. */
  capturedTimeRange: CapturedTimeRange;
  disabled: boolean;
}

export function LockTimeRangeField({ control, capturedTimeRange, disabled }: Props) {
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
          label={t('notebooks.add-panel.lock-time-range', 'Lock to {{range}}', {
            range: describeCapturedTimeRange(capturedTimeRange),
            // The range is formatted dates, not markup, and escaping turns its separators into
            // entities the reader can see.
            interpolation: { escapeValue: false },
          })}
          description={t(
            'notebooks.add-panel.lock-time-range-description',
            'Keep this visualization on the window it was captured in. Unlocked, it follows the notebook time range.'
          )}
        />
      )}
    />
  );
}
