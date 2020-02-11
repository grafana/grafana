import React, { FC } from 'react';
import RcTimePicker from 'rc-time-picker';
import { css } from 'emotion';
import { dateTime, DateTime, dateTimeAsMoment, GrafanaTheme } from '@grafana/data';
import { useTheme, Icon } from '../../index';
import { stylesFactory } from '../../themes';
import { inputSizes } from '../Forms/commonStyles';
import { FormInputSize } from '../Forms/types';

interface Props {
  onChange: (value: DateTime) => void;
  value: DateTime;
  showHour?: boolean;
  minuteStep?: number;
  size?: FormInputSize;
}

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    caretWrapper: css`
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      display: inline-block;
      text-align: right;
      z-index: 1071;
    `,
    picker: css`
      .rc-time-picker-panel-select {
        border-color: ${theme.colors.dark6};
        font-size: 14px;
        li {
          outline-width: 2px;
          &.rc-time-picker-panel-select-option-selected {
            background-color: inherit;
            border: 1px solid ${theme.colors.orange};
            border-radius: ${theme.border.radius.sm};
          }
        }
      }
    `,
  };
});

export const TimeOfDayPicker: FC<Props> = ({ minuteStep = 1, showHour = true, onChange, value, size = 'auto' }) => {
  const theme = useTheme();
  const styles = getStyles(theme);
  return (
    <div>
      <RcTimePicker
        className={inputSizes()[size]}
        popupClassName={styles.picker}
        defaultValue={dateTimeAsMoment()}
        onChange={(value: any) => onChange(dateTime(value))}
        allowEmpty={false}
        showSecond={false}
        value={dateTimeAsMoment(value)}
        showHour={showHour}
        minuteStep={minuteStep}
        inputIcon={<Caret wrapperStyle={styles.caretWrapper} />}
      />
    </div>
  );
};

interface CaretProps {
  wrapperStyle?: string;
}

const Caret: FC<CaretProps> = ({ wrapperStyle = '' }) => {
  return (
    <div className={wrapperStyle}>
      <Icon name="caret-down" />
    </div>
  );
};
