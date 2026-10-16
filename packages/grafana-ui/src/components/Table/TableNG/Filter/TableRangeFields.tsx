import { type ComponentProps, type Ref, type RefObject, useId, useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { Button } from '../../../Button/Button';
import { Field } from '../../../Forms/Field';
import { Input } from '../../../Input/Input';
import { Stack } from '../../../Layout/Stack/Stack';

import { TableRangeCalendar } from './TableRangeCalendar';

interface RangeField {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
  placeholder?: string;
  testId?: string;
}

interface Props {
  from: RangeField;
  to: RangeField;
  calendar: Omit<ComponentProps<typeof TableRangeCalendar>, 'isOpen' | 'onClose' | 'anchorElement'>;
  calendarAnchor: RefObject<HTMLElement | null>;
}

// Keep range inputs local until shared date range fields support an anchored calendar.
export function TableRangeFields({ from, to, calendar, calendarAnchor }: Props) {
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
        { field: from, id: fromId },
        { field: to, id: toId },
      ].map(({ field, id }) => (
        <Stack key={id} gap={0}>
          <Field label={field.label}>
            <Input
              id={id}
              autoComplete="off"
              value={field.value}
              onChange={(event) => field.onChange(event.currentTarget.value)}
              ref={field.inputRef}
              placeholder={field.placeholder}
              data-testid={field.testId}
              width={36}
              onClick={(event) => event.stopPropagation()}
              addonAfter={icon}
            />
          </Field>
        </Stack>
      ))}
      <TableRangeCalendar
        {...calendar}
        anchorElement={calendarAnchor.current}
        isOpen={isOpen}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
