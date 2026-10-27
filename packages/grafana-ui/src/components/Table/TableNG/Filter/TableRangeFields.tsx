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
  invalid?: boolean;
  errorId?: string;
}

interface Props {
  from: RangeField;
  to: RangeField;
  calendar: Omit<ComponentProps<typeof TableRangeCalendar>, 'isOpen' | 'onClose' | 'anchorElement'>;
  calendarAnchor: RefObject<HTMLElement | null>;
  calendarDisabled?: boolean;
}

// Keep range inputs local until shared date range fields support an anchored calendar.
export function TableRangeFields({ from, to, calendar, calendarAnchor, calendarDisabled }: Props) {
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
      disabled={calendarDisabled}
      onClick={() => setOpen(true)}
    />
  );

  return (
    <Stack direction="column" gap={1}>
      {[
        { field: from, id: fromId, bound: 'minimum' },
        { field: to, id: toId, bound: 'maximum' },
      ].map(({ field, id, bound }) => (
        <Field
          key={id}
          label={field.label}
          data-testid={selectors.components.Panels.Visualization.TableNG.Filters.Range.field(bound)}
        >
          <Input
            id={id}
            autoComplete="off"
            value={field.value}
            onChange={(event) => field.onChange(event.currentTarget.value)}
            ref={field.inputRef}
            placeholder={field.placeholder}
            width={30}
            data-testid={field.testId}
            invalid={field.invalid}
            aria-describedby={field.invalid ? field.errorId : undefined}
            onClick={(event) => event.stopPropagation()}
            addonAfter={icon}
          />
        </Field>
      ))}
      <TableRangeCalendar
        {...calendar}
        anchorElement={calendarAnchor.current}
        isOpen={isOpen}
        onClose={() => setOpen(false)}
      />
    </Stack>
  );
}
