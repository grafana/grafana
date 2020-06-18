import React, { FC } from 'react';
import { css } from 'emotion';
import { TimeZone, GrafanaTheme, getTimeZoneInfo } from '@grafana/data';
import { stylesFactory, useTheme } from '../../../themes';
import { TimeZoneTitle } from '../../TimeZonePicker/TimeZoneTitle';
import { TimeZoneDescription } from '../../TimeZonePicker/TimeZoneDescription';
import { TimeZoneOffset } from '../../TimeZonePicker/TimeZoneOffset';

interface Props {
  timeZone?: TimeZone;
  timestamp: number;
}

export const TimePickerFooter: FC<Props> = props => {
  const { timeZone, timestamp } = props;
  const theme = useTheme();
  const style = getStyle(theme);

  if (!timeZone) {
    return null;
  }

  const info = getTimeZoneInfo(timeZone, timestamp);

  if (!info) {
    return null;
  }

  return (
    <div className={style.container}>
      <div className={style.timeZoneContainer}>
        <div className={style.timeZone}>
          <TimeZoneTitle title={info.name} />
          <TimeZoneDescription info={info} />
        </div>
        <TimeZoneOffset timeZone={timeZone} timestamp={timestamp} />
      </div>
      <div>Button</div>
    </div>
  );
};

const getStyle = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      height: 40px;
      display: flex;
      flex-direction: row;
      justify-content: space-between;
    `,
    timeZoneContainer: css`
      display: flex;
      flex-direction: row;
      justify-content: space-between;
    `,
    timeZone: css`
      display: flex;
      flex-direction: row;
      align-items: center;
    `,
    offset: css``,
  };
});
