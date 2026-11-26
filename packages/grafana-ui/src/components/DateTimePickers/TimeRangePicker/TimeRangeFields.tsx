import { css } from '@emotion/css';
import { type ReactNode, type Ref, useId, useState, useRef, useLayoutEffect } from 'react';

import { type DateTime } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { Button } from '../../Button/Button';
import { Field } from '../../Forms/Field';
import { Input } from '../../Input/Input';
import { Stack } from '../../Layout/Stack/Stack';

import { InlineTimePickerCalendar } from './InlineTimePickerCalendar';
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
  fieldTestId?: string;
}

interface Props {
  inlineCalendar?: boolean;
  fullWidth?: boolean;
  onCalendarOpenChange?: (open: boolean) => void;
  from: RangeField;
  to: RangeField;
  inputWidth?: number;
  onSubmit?: () => void;
  fieldSuffix?: ReactNode;
  calendar: Omit<TimePickerCalendarProps, 'isOpen' | 'onClose'>;
}

/** Shared absolute-range inputs and calendar; callers own parsing, validation, and applying the range. */
export function TimeRangeFields({
  from,
  to,
  inputWidth,
  onSubmit,
  fieldSuffix,
  calendar,
  inlineCalendar,
  fullWidth,
  onCalendarOpenChange,
}: Props) {
  const fromId = useId();
  const toId = useId();
  const [isOpen, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ from: DateTime; to: DateTime }>();
  const triggerInputId = useRef(fromId);
  const restoreInputFocus = useRef(false);
  useLayoutEffect(() => {
    if (!isOpen && restoreInputFocus.current) {
      document.getElementById(triggerInputId.current)?.focus();
      restoreInputFocus.current = false;
    }
  }, [isOpen]);
  const closeCalendar = () => {
    restoreInputFocus.current = !!inlineCalendar;
    setOpen(false);
    onCalendarOpenChange?.(false);
  };
  const icon = (id: string) => (
    <Button
      aria-label={t('time-picker.range-content.open-input-calendar', 'Open calendar')}
      aria-expanded={isOpen}
      data-testid={selectors.components.TimePicker.calendar.openButton}
      icon="calendar-alt"
      variant="secondary"
      type="button"
      onClick={() => {
        triggerInputId.current = id;
        setDraft({ from: calendar.from, to: calendar.to });
        setOpen(true);
        onCalendarOpenChange?.(true);
      }}
    />
  );

  if (inlineCalendar && isOpen && draft) {
    return (
      <InlineTimePickerCalendar
        {...calendar}
        {...draft}
        onChange={(from, to) => setDraft({ from, to })}
        onClose={closeCalendar}
        onUpdateInputs={() => {
          calendar.onChange(draft.from, draft.to);
          closeCalendar();
        }}
      />
    );
  }

  return (
    <>
      {[
        { field: from, label: t('time-picker.range-content.from-input', 'From'), id: fromId },
        { field: to, label: t('time-picker.range-content.to-input', 'To'), id: toId },
      ].map(({ field, label, id }) => (
        <Stack key={id} gap={0}>
          <Field
            className={fullWidth ? css({ width: '100%' }) : undefined}
            label={field.label ?? label}
            invalid={!!field.error}
            error={field.error}
            data-testid={field.fieldTestId}
          >
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
              addonAfter={icon(id)}
            />
          </Field>
          {fieldSuffix}
        </Stack>
      ))}
      <TimePickerCalendar {...calendar} isOpen={isOpen} onClose={closeCalendar} />
    </>
  );
}
