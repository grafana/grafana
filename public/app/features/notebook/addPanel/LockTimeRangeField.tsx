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

/**
 * The capture's time-range choice, below the destination because it describes what is being added
 * rather than where it goes — and so it reads the same whichever route the modal is on.
 *
 * Its default comes from the range itself (see shouldLockCapturedTimeRange) and is applied through
 * the form's defaultValues, so flipping it here is an override that survives re-renders and
 * switching between the new and existing routes.
 *
 * No enclosing Field: a "Time range" label above a checkbox that already names the range it locks to
 * says the same thing twice, and a second label element would also be read out as part of the
 * checkbox's own name.
 */
export function LockTimeRangeField({ control, capturedTimeRange, disabled }: Props) {
  return (
    <Controller
      control={control}
      name="lockTimeRange"
      render={({ field: { value, onChange, ref, ...field } }) => (
        // Wrapped so the column Stack stretches the div rather than the Checkbox. Checkbox is an
        // inline-grid with no column sizes, so stretching it hands the spare width to the checkbox
        // column and pushes the label away from its box.
        <div>
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
        </div>
      )}
    />
  );
}
