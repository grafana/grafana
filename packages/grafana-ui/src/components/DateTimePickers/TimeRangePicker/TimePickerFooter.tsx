import React, { FC, useState, useCallback } from 'react';
import { css, cx } from '@emotion/css';
import { TimeZone, GrafanaTheme2, getTimeZoneInfo } from '@grafana/data';
import { stylesFactory, useTheme2 } from '../../../themes';
import { TimeZoneTitle } from '../TimeZonePicker/TimeZoneTitle';
import { TimeZoneDescription } from '../TimeZonePicker/TimeZoneDescription';
import { TimeZoneOffset } from '../TimeZonePicker/TimeZoneOffset';
import { Button } from '../../Button';
import { TimeZonePicker } from '../TimeZonePicker';
import { isString } from 'lodash';
import { selectors } from '@grafana/e2e-selectors';

interface Props {
  timeZone?: TimeZone;
  timestamp?: number;
  onChangeTimeZone: (timeZone: TimeZone) => void;
}

export const TimePickerFooter: FC<Props> = (props) => {
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

  const theme = useTheme2();
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
        <section aria-label={selectors.components.TimeZonePicker.container} className={style.timeZoneContainer}>
          <TimeZonePicker
            includeInternal={true}
            onChange={(timeZone) => {
              onToggleChangeTz();

              if (isString(timeZone)) {
                onChangeTimeZone(timeZone);
              }
            }}
            autoFocus={true}
            onBlur={onToggleChangeTz}
          />
        </section>
      </div>
    );
  }

  return (
    <section aria-label="Time zone selection" className={style.container}>
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
    </section>
  );
};

const getStyle = stylesFactory((theme: GrafanaTheme2) => {
  return {
    container: css`
      border-top: 1px solid ${theme.colors.border.weak};
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
