import { type ReactNode, type Ref, type RefObject, useId, useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { Button } from '../../Button/Button';
import { Field } from '../../Forms/Field';
import { Input } from '../../Input/Input';
import { Stack } from '../../Layout/Stack/Stack';

import TimePickerCalendar, { type TimePickerCalendarProps } from './TimePickerCalendar';

interface RangeField {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  inputRef?: Ref<HTMLInputElement>;
  label?: string;
  error?: string;
  placeholder?: string;
  testId?: string;
}

interface Props {
  from: RangeField;
  to: RangeField;
  inputWidth?: number;
  onSubmit?: () => void;
  fieldSuffix?: ReactNode;
  calendar: Omit<TimePickerCalendarProps, 'isOpen' | 'onClose' | 'anchorElement'>;
  calendarAnchor: RefObject<HTMLElement | null>;
}

/** Shared absolute-range inputs and calendar; callers own parsing, validation, and applying the range. */
export function TimeRangeFields({ from, to, inputWidth, onSubmit, fieldSuffix, calendar, calendarAnchor }: Props) {
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
        { field: from, label: t('time-picker.range-content.from-input', 'From'), id: fromId },
        { field: to, label: t('time-picker.range-content.to-input', 'To'), id: toId },
      ].map(({ field, label, id }) => (
        <Stack key={id} gap={0}>
          <Field label={field.label ?? label} invalid={!!field.error} error={field.error}>
            <Input
              id={id}
              autoComplete="off"
              value={field.value}
              onChange={(event) => field.onChange(event.currentTarget.value)}
              onBlur={field.onBlur}
              ref={field.inputRef}
              placeholder={field.placeholder}
              data-testid={field.testId}
              width={inputWidth}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  onSubmit?.();
                }
              }}
              addonAfter={icon}
            />
          </Field>
          {fieldSuffix}
        </Stack>
      ))}
      <TimePickerCalendar
        {...calendar}
        anchorElement={calendarAnchor.current}
        isOpen={isOpen}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
