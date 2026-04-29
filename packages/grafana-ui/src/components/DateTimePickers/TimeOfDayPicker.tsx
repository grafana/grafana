import { useMemo, useState } from 'react';

// import { dateTime, type DateTime, dateTimeAsMoment, isDateTimeInput } from '@grafana/data';

import { type DateTime } from '@grafana/data';

import { Combobox } from '../Combobox/Combobox';
import { type ComboboxOption } from '../Combobox/types';
import { type FormInputSize } from '../Forms/types';

interface BaseProps {
  onChange: (value: DateTime) => void | ((value?: DateTime) => void);
  value?: DateTime;
  showHour?: boolean;
  showSeconds?: boolean;
  minuteStep?: 1 | 5 | 10 | 15 | 20 | 30;
  size?: FormInputSize;
  disabled?: boolean;
  disabledHours?: () => number[];
  disabledMinutes?: () => number[];
  disabledSeconds?: () => number[];
  placeholder?: string;
  allowEmpty?: boolean;
  id?: string;
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
  showHour = true,
  showSeconds = false,
  value,
  size = 'auto',
  disabled,
  disabledHours,
  disabledMinutes,
  disabledSeconds,
  id,
  placeholder,
  allowEmpty = false,
}: Props) => {
  const [selected, setSelected] = useState<string | null>(null);

  const opts = useMemo(() => {
    let opts: Array<ComboboxOption<string>> = [];

    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += minuteStep) {
        opts.push({ value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` });
      }
    }

    return opts;
  }, [minuteStep]);

  return (
    <Combobox
      id={id}
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
      placeholder="HH:mm"
      createCustomValue={true}
      options={opts}
      value={selected}
      isClearable={allowEmpty}

      width={12}

      onChange={(option?: ComboboxOption<string> | null) => {
        // console.log(value);

        setSelected(option?.value ?? null);

        // if (isDateTimeInput(value)) {
        //   if (restProps.allowEmpty) {
        //     return restProps.onChange(value ? dateTime(value) : undefined);
        //   } else {
        //     return restProps.onChange(dateTime(value));
        //   }
        // }
      }}
    />
  );
};
