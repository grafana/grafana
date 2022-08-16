import React, { ChangeEvent } from 'react';
import { InlineLabel, stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { QueryBuilderFieldProps } from './types';
import { onBuilderChange } from '.';
import { css, cx, injectGlobal } from '@emotion/css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

injectGlobal(`
  .react-datepicker__triangle {
    display: none;
  }
  .react-datepicker-popper {
    z-index: 1000 !important;
  }
`);

interface Props extends QueryBuilderFieldProps {
  format: string;
  time: boolean;
}

const ISO8601DURATIONPATTERN = new RegExp(
  '([-+]?)P(?:([-+]?[0-9]+)D)?(T(?:([-+]?[0-9]+)H)?(?:([-+]?[0-9]+)M)?(?:([-+]?[0-9]+)(?:[.,]([0-9]{0,9}))?S)?)?',
  'i'
);

const useInterval = (interval = ''): any => {
  const intervalPartToDate = (part: string): any => {
    var date: Date | undefined = undefined;
    var datePlaceholder: string | undefined = undefined;
    const d = new Date(part);
    if (d instanceof Date && !isNaN(d.getFullYear())) {
      date = d;
    } else {
      datePlaceholder = part;
    }
    return [date, datePlaceholder, part];
  };
  const [start, stop] = interval.split('/');
  return [...intervalPartToDate(start), ...intervalPartToDate(stop)];
};

export const DateInterval = (props: Props) => {
  const [startDate, startDatePlaceholder, intervalStart, stopDate, stopDatePlaceholder, intervalStop] = useInterval(
    props.options.builder
  );

  const onStartDateChangeRaw = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (value && value.indexOf('$') !== -1) {
      onBuilderChange(props, value + '/' + intervalStop);
    }
  };
  const onStartDateChange = (date: Date) => {
    const value = date.toISOString();
    onBuilderChange(props, value + '/' + intervalStop);
  };
  const onStopDateChangeRaw = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (value && (value.indexOf('$') !== -1 || ISO8601DURATIONPATTERN.exec(value) !== null)) {
      onBuilderChange(props, intervalStart + '/' + value);
    }
  };
  const onStopDateChange = (date: Date) => {
    const value = date.toISOString();
    onBuilderChange(props, intervalStart + '/' + value);
  };
  const { label, description, format, time } = props;
  const theme = useTheme();
  const styles = getStyles(theme);
  return (
    <>
      <InlineLabel tooltip={description} width="auto">
        {label}
      </InlineLabel>
      <InlineLabel width="auto">Start</InlineLabel>
      <DatePicker
        selected={startDate}
        startDate={startDate}
        endDate={stopDate}
        placeholderText={startDatePlaceholder}
        onChangeRaw={onStartDateChangeRaw}
        onChange={onStartDateChange}
        showTimeSelect={time}
        dateFormat={format}
        wrapperClassName={cx(styles.picker)}
        selectsStart
      />
      <InlineLabel width="auto">Stop</InlineLabel>
      <DatePicker
        selected={stopDate}
        startDate={startDate}
        endDate={stopDate}
        placeholderText={stopDatePlaceholder}
        onChangeRaw={onStopDateChangeRaw}
        onChange={onStopDateChange}
        showTimeSelect={time}
        dateFormat={format}
        wrapperClassName={cx(styles.picker)}
        selectsEnd
      />
    </>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    picker: css`
      & input {
        border: 1px solid ${theme.colors.border2};
        height: 32px;
        margin-right: 4px;
      }
    `,
  };
});
