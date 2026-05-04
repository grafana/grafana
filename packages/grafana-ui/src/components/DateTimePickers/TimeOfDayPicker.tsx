import { useMemo, useState } from 'react';

import { dateTime, dateTimeFormat, type DateTime } from '@grafana/data';

import { Combobox } from '../Combobox/Combobox';
import { type ComboboxOption } from '../Combobox/types';
import { type FormInputSize } from '../Forms/types';

interface BaseProps {
  onChange: (value: DateTime) => void | ((value?: DateTime) => void);
  value?: DateTime;
  showSeconds?: boolean;
  minuteStep?: 5 | 10 | 15 | 20 | 30;
  size?: FormInputSize;
  disabled?: boolean;
  disabledHours?: () => number[];
  placeholder?: string;
  allowEmpty?: boolean;
  id?: string;

  // weird / unused / deprecated
  showHour?: boolean;
  disabledMinutes?: () => number[];
  disabledSeconds?: () => number[];
}

interface AllowEmptyProps extends BaseProps {
  allowEmpty: true;
  onChange: (value?: DateTime) => void;
}

interface NoAllowEmptyProps extends BaseProps {
  allowEmpty?: false;
  onChange: (value: DateTime) => void;
}

export type Props = AllowEmptyProps | NoAllowEmptyProps;

export const TimeOfDayPicker = ({
  minuteStep = 15,
  showSeconds = false,
  value,
  // todo: hook up?
  size = 'auto',
  disabled,
  disabledHours,
  id,
  placeholder,
  allowEmpty = false,
  onChange,
}: Props) => {
  const opts = useMemo(() => {
    // technically not correct to only call this on callback identity change, but unlikely to matter in practice
    const skipHours = new Set(disabledHours?.());

    const opts: Array<ComboboxOption<string>> = [];

    for (let h = 0; h < 24; h++) {
      if (!skipHours.has(h)) {
        for (let m = 0; m < 60; m += minuteStep) {
          opts.push({ value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` });
        }
      }
    }

    return opts;
  }, [minuteStep, disabledHours]);

  const initValue = useMemo(
    () => (value ? dateTimeFormat(value, { format: showSeconds ? 'HH:mm:ss' : 'HH:mm' }) : null),
    [value, showSeconds]
  );

  const [selected, setSelected] = useState<string | null>(initValue);

  return (
    <Combobox
      id={id}
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      placeholder={placeholder ?? (showSeconds ? 'HH:mm:ss' : 'HH:mm')}
      disabled={disabled}
      createCustomValue={true}
      options={opts}
      value={selected}
      isClearable={allowEmpty}
      width={showSeconds ? 14 : 12}
      onChange={(option?: ComboboxOption<string> | null) => {
        // todo: ensure valid format

        const optVal = option?.value ?? '00:00:00';

        const [HH, mm, ss] = optVal.split(':').map(Number);

        // copy original or create new dateTime
        const newValue = value != null ? dateTime(value) : dateTime();

        newValue.set('hour', HH ?? 0);
        newValue.set('minute', mm ?? 0);
        newValue.set('second', ss ?? 0);

        // always show as selected or entered
        setSelected(option?.value ?? null);

        onChange(newValue);
      }}
    />
  );
};
