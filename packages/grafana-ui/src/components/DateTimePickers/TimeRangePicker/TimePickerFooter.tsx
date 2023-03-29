import { css, cx } from '@emotion/css';
import { isString } from 'lodash';
import React, { useCallback, useState } from 'react';

import { getTimeZoneInfo, GrafanaTheme2, TimeZone } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { Field, RadioButtonGroup, Select } from '../..';
import { stylesFactory, useTheme2 } from '../../../themes';
import { t, Trans } from '../../../utils/i18n';
import { Button } from '../../Button';
import { TimeZonePicker } from '../TimeZonePicker';
import { TimeZoneDescription } from '../TimeZonePicker/TimeZoneDescription';
import { TimeZoneOffset } from '../TimeZonePicker/TimeZoneOffset';
import { TimeZoneTitle } from '../TimeZonePicker/TimeZoneTitle';
import { monthOptions } from '../options';

interface Props {
  timeZone?: TimeZone;
  fiscalYearStartMonth?: number;
  timestamp?: number;
  onChangeTimeZone: (timeZone: TimeZone) => void;
  onChangeFiscalYearStartMonth?: (month: number) => void;
}

export const TimePickerFooter = (props: Props) => {
  const {
    timeZone,
    fiscalYearStartMonth,
    timestamp = Date.now(),
    onChangeTimeZone,
    onChangeFiscalYearStartMonth,
  } = props;
  const [isEditing, setEditing] = useState(false);
  const [editMode, setEditMode] = useState('tz');

  const onToggleChangeTimeSettings = useCallback(
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

  return (
    <div>
      <section
        aria-label={t('time-picker.footer.time-zone-selection', 'Time zone selection')}
        className={style.container}
      >
        <div className={style.timeZoneContainer}>
          <div className={style.timeZone}>
            <TimeZoneTitle title={info.name} />
            <div className={style.spacer} />
            <TimeZoneDescription info={info} />
          </div>
          <TimeZoneOffset timeZone={timeZone} timestamp={timestamp} />
        </div>
        <div className={style.spacer} />
        <Button variant="secondary" onClick={onToggleChangeTimeSettings} size="sm">
          <Trans i18nKey="time-picker.footer.change-settings-button">Change time settings</Trans>
        </Button>
      </section>
      {isEditing ? (
        <div className={style.editContainer}>
          <div>
            <RadioButtonGroup
              value={editMode}
              options={[
                { label: t('time-picker.footer.time-zone-option', 'Time zone'), value: 'tz' },
                { label: t('time-picker.footer.fiscal-year-option', 'Fiscal year'), value: 'fy' },
              ]}
              onChange={setEditMode}
            ></RadioButtonGroup>
          </div>
          {editMode === 'tz' ? (
            <section
              data-testid={selectors.components.TimeZonePicker.containerV2}
              className={cx(style.timeZoneContainer, style.timeSettingContainer)}
            >
              <TimeZonePicker
                includeInternal={true}
                onChange={(timeZone) => {
                  onToggleChangeTimeSettings();

                  if (isString(timeZone)) {
                    onChangeTimeZone(timeZone);
                  }
                }}
                onBlur={onToggleChangeTimeSettings}
              />
            </section>
          ) : (
            <section
              aria-label={selectors.components.TimeZonePicker.containerV2}
              className={cx(style.timeZoneContainer, style.timeSettingContainer)}
            >
              <Field
                className={style.fiscalYearField}
                label={t('time-picker.footer.fiscal-year-start', 'Fiscal year start month')}
              >
                <Select
                  value={fiscalYearStartMonth}
                  menuShouldPortal={false}
                  options={monthOptions}
                  onChange={(value) => {
                    if (onChangeFiscalYearStartMonth) {
                      onChangeFiscalYearStartMonth(value.value ?? 0);
                    }
                  }}
                />
              </Field>
            </section>
          )}
        </div>
      ) : null}
    </div>
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
      border-top: 1px solid ${theme.colors.border.weak};
      padding: 11px;
      justify-content: space-between;
      align-items: center;
      padding: 7px;
    `,
    spacer: css`
      margin-left: 7px;
    `,
    timeSettingContainer: css`
      padding-top: ${theme.spacing(1)};
    `,
    fiscalYearField: css`
      margin-bottom: 0px;
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
