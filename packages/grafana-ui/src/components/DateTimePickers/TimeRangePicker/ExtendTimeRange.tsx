import { css } from '@emotion/css';
import { FormEvent, ReactNode, useCallback, useId, useState, useRef } from 'react';
import * as React from 'react';
import {
    DateTime,
    dateTime,
    dateTimeFormat,
    dateTimeParse,
    GrafanaTheme2,
    isDateTime,
    rangeUtil,
    RawTimeRange,
    TimeRange,
    TimeZone,
    TimeOption,
  } from '@grafana/data';

import { useStyles2 } from '../../../themes';
import { t } from '../../../utils/i18n';

import { TimePickerTitle } from './TimePickerTitle';
import { DateTimePicker} from '../DateTimePicker/DateTimePicker'

import { Button } from '../../Button';

import { locationService } from '@grafana/runtime';

/*
 * 本组件是提供一个日期选择组件，并列出 早班、中班、晚班、白班、夜班、全天 这些选项
 * 对于一个日期 X:
 *  - 早班相当于 X 08:00:00 到 X 15:59:59
 *  - 中班相当于 X 16:00:00 到 X 23:59:59
 *  - 晚班相当于 X+1 00:00:00 到 X+1 07:59:59
 *  - 白班相当于 X 08:00:00 到 X 19:59:59
 *  - 夜班相当于 X 20:00:00 到 X+1 07:59:59
 *  - 全天相当于 X 08:00:00 到 X+1 07:59:59
 * 
 * 选择日期后，点击选项，会生成一个时间范围，并触发 onChange 回调
 */

interface TimeSpan {
  years?: number;
  months?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
}
function getTimeSpanValue(span: TimeSpan) : number {
  return (span.years || 0) * 365 * 24 * 60 * 60 + (span.months || 0) * 30 * 24 * 60 * 60 + (span.days || 0) * 24 * 60 * 60 + (span.hours || 0) * 60 * 60 + (span.minutes || 0) * 60 + (span.seconds || 0);
}

interface TimeSpanOption {
  text: string;
  from: TimeSpan;
  to: TimeSpan;
}

const timeOptions = [
    {
        text: '早班',
        from: { hours: 8 },
        to: { hours: 15, minutes: 59, seconds: 59 }
    },
    {
        text: '中班',
        from: { hours: 16 },
        to: { hours: 23, minutes: 59, seconds: 59 }
    },
    {
        text: '晚班',
        from: { hours: 24 },
        to: { days: 1, hours: 7, minutes: 59, seconds: 59 }
    },
    {
        text: '白班',
        from: { hours: 8 },
        to: { hours: 19, minutes: 59, seconds: 59 }
    },
    {
        text: '夜班',
        from: { hours: 20 },
        to: { days: 1, hours: 7, minutes: 59, seconds: 59 }
    },
    {
        text: '全天',
        from: { hours: 8 },
        to: { days: 1, hours: 7, minutes: 59, seconds: 59 }
    }
];

interface Props {
  onChange: (option: TimeOption) => void;
  value?: DateTime;
  title?: string;
  timeZone?: TimeZone;
}

const getStyles = (theme: GrafanaTheme2) => ({
  list: css({
    padding: '8px 16px 5px 9px',
  }),
  title: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px 5px 9px',
  }),
  body: css({
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  form: css({
    padding: '7px 9px 7px 9px',
  }),
  fieldContainer: css({
    display: 'flex',
  }),
  buttonsContainer: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(1),
  }),
  button: css({
  }),
});

const getLastDate = () => {
  let lastDate = locationService.getSearchObject().lastDate;
  let datetime;
  if (!lastDate) {
    datetime = dateTime(new Date());
  } else {
    datetime = dateTime(lastDate);
  }
  return datetime;
}

const setLastDate = (date: DateTime) => {
  locationService.partial({ lastDate: date.toISOString() });
}

export const ExtendTimeRange = (props: Props) => {
  const { onChange, value, title, timeZone } = props;
  const styles = useStyles2(getStyles);

  const [date, setDate] = useState<DateTime>(value || getLastDate());

  const onSelectTimeRange = useCallback(
    (option: TimeSpanOption) => {
      setLastDate(date);
      const from = dateTime(date).add(getTimeSpanValue(option.from), 'second');
      const to = dateTime(date).add(getTimeSpanValue(option.to), 'second');
      onChange({
        display: option.text,
        from: from.toISOString(),
        to: to.toISOString()
      })
    },
    [onChange, date, timeZone]
  );

  return (
        <section aria-label={title}>
          <fieldset>
            <div className={styles.title}>
              <TimePickerTitle>{title}</TimePickerTitle>
            </div>
            <div className={styles.body} id="expanded-timerange">
              <div className={styles.form}>
                <div>
                    <div className={styles.fieldContainer}>
                    <DateTimePicker
                    date={date}
                    onChange={setDate}
                    timeZone={timeZone}
                    maxDate={new Date()}
                    clearable={true}
                    dateOnly={true}
                    />
                    </div>
                    <div className={styles.buttonsContainer}>

                    {timeOptions.map((option) => (
                    <Button
                        variant="secondary"
                        type="button"
                        className={styles.button}
                        onClick={() => onSelectTimeRange(option)}
                    >
                        {option.text}
                    </Button>
                    ))}
                    </div>
                </div>
              </div>
            </div>
          </fieldset>
        </section>
  );
};