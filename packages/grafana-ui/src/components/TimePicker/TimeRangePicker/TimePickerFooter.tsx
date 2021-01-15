import React, { FC, useState, useCallback } from 'react';
import { css, cx } from 'emotion';
import { TimeZone, GrafanaTheme, getTimeZoneInfo } from '@grafana/data';
import { stylesFactory, useTheme } from '../../../themes';
import { TimeZoneTitle } from '../TimeZonePicker/TimeZoneTitle';
import { TimeZoneDescription } from '../TimeZonePicker/TimeZoneDescription';
import { TimeZoneOffset } from '../TimeZonePicker/TimeZoneOffset';
import { Button } from '../../Button';
import { TimeZonePicker } from '../TimeZonePicker';
import isString from 'lodash/isString';
import { selectors } from '@grafana/e2e-selectors';

interface Props {
  timeZone?: TimeZone;
  timestamp?: number;
  onChangeTimeZone: (timeZone: TimeZone) => void;
}

export const TimePickerFooter: FC<Props> = props => {
  const { timeZone, timestamp = Date.now(), onChangeTimeZone } = props;
  const [isEditing, setEditing] = useState(false);

  const onToggleChangeTz = useCallback(
    (event?: React.MouseEvent) => {
      if (event) {
        event.stopPropagation();
      }
      setEditing(!isEditing);
    },
    [isEditing, setEditing]
  );

  const theme = useTheme();
  const style = getStyle(theme);

  if (!isString(timeZone)) {
    return null;
  }

  const info = getTimeZoneInfo(timeZone, timestamp);

  if (!info) {
    return null;
  }

  if (isEditing) {
    return (
      <div className={cx(style.container, style.editContainer)}>
        <div aria-label={selectors.components.TimeZonePicker.container} className={style.timeZoneContainer}>
          <TimeZonePicker
            includeInternal={true}
            onChange={timeZone => {
              onToggleChangeTz();

              if (isString(timeZone)) {
                onChangeTimeZone(timeZone);
              }
            }}
            autoFocus={true}
            onBlur={onToggleChangeTz}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={style.container}>
      <div className={style.timeZoneContainer}>
        <div className={style.timeZone}>
          <TimeZoneTitle title={info.name} />
          <div className={style.spacer} />
          <TimeZoneDescription info={info} />
        </div>
        <TimeZoneOffset timeZone={timeZone} timestamp={timestamp} />
      </div>
      <div className={style.spacer} />
      <Button variant="secondary" onClick={onToggleChangeTz} size="sm">
        Change time zone
      </Button>
    </div>
  );
};

const getStyle = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      border-top: 1px solid ${theme.colors.border1};
      padding: 11px;
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
    `,
    editContainer: css`
      padding: 7px;
    `,
    spacer: css`
      margin-left: 7px;
    `,
    timeZoneContainer: css`
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      flex-grow: 1;
    `,
    timeZone: css`
      display: flex;
      flex-direction: row;
      align-items: baseline;
      flex-grow: 1;
    `,
  };
});
