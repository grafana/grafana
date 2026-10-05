import { css } from '@emotion/css';
import { type ComponentPropsWithRef, type ReactNode, useId, useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { Button } from '../../Button/Button';
import { Field } from '../../Forms/Field';
import { Input } from '../../Input/Input';

import TimePickerCalendar, { type TimePickerCalendarProps } from './TimePickerCalendar';

type RangeInputProps = ComponentPropsWithRef<typeof Input> & { 'data-testid'?: string };

interface Props {
  fromInput: RangeInputProps;
  toInput: RangeInputProps;
  fromLabel?: string;
  toLabel?: string;
  fromError?: string;
  toError?: string;
  fieldSuffix?: ReactNode;
  calendar: Omit<TimePickerCalendarProps, 'isOpen' | 'onClose' | 'anchorElement'>;
  getCalendarAnchor?: () => HTMLElement | null;
}

/** Shared absolute-range inputs and calendar; callers own parsing, validation, and applying the range. */
export function TimeRangeFields({
  fromInput,
  toInput,
  fromLabel = t('time-picker.range-content.from-input', 'From'),
  toLabel = t('time-picker.range-content.to-input', 'To'),
  fromError,
  toError,
  fieldSuffix,
  calendar,
  getCalendarAnchor,
}: Props) {
  const fromId = useId();
  const toId = useId();
  const [isOpen, setOpen] = useState(false);
  const icon = (
    <Button
      aria-label={t('time-picker.range-content.open-input-calendar', 'Open calendar')}
      aria-expanded={isOpen}
      data-testid={selectors.components.TimePicker.calendar.openButton}
      icon="calendar-alt"
      variant="secondary"
      type="button"
      onClick={() => setOpen(true)}
    />
  );

  return (
    <>
      {[
        { input: fromInput, label: fromLabel, error: fromError, id: fromId },
        { input: toInput, label: toLabel, error: toError, id: toId },
      ].map(({ input, label, error, id }) => (
        <div key={id} className={rowStyle}>
          <Field label={label} invalid={!!error} error={error} className={fieldStyle}>
            <Input id={id} autoComplete="off" {...input} addonAfter={icon} />
          </Field>
          {fieldSuffix}
        </div>
      ))}
      <TimePickerCalendar
        {...calendar}
        anchorElement={getCalendarAnchor?.()}
        isOpen={isOpen}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const rowStyle = css({ display: 'flex' });
const fieldStyle = css({ width: 208, maxWidth: '100%' });
