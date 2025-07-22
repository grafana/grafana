import { css, cx } from '@emotion/css';
import { isString } from 'lodash';
import { useCallback, useId, useState } from 'react';
import * as React from 'react';

import { getTimeZoneInfo, GrafanaTheme2, TimeZone } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';

import { useStyles2 } from '../../../themes/ThemeContext';
import { Button } from '../../Button/Button';
import { Combobox } from '../../Combobox/Combobox';
import { Field } from '../../Forms/Field';
import { Tab } from '../../Tabs/Tab';
import { TabContent } from '../../Tabs/TabContent';
import { TabsBar } from '../../Tabs/TabsBar';
import { TimeZonePicker } from '../TimeZonePicker';
import { TimeZoneDescription } from '../TimeZonePicker/TimeZoneDescription';
import { TimeZoneOffset } from '../TimeZonePicker/TimeZoneOffset';
import { TimeZoneTitle } from '../TimeZonePicker/TimeZoneTitle';
import { getMonthOptions } from '../options';

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

  const timeSettingsId = useId();
  const timeZoneSettingsId = useId();
  const fiscalYearSettingsId = useId();

  const onToggleChangeTimeSettings = useCallback(
    (event?: React.MouseEvent) => {
      if (event) {
        event.stopPropagation();
      }
      setEditing(!isEditing);
    },
    [isEditing, setEditing]
  );

  const style = useStyles2(getStyle);

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
        <Button
          data-testid={selectors.components.TimeZonePicker.changeTimeSettingsButton}
          variant="secondary"
          onClick={onToggleChangeTimeSettings}
          size="sm"
          aria-expanded={isEditing}
          aria-controls={timeSettingsId}
          icon={isEditing ? 'angle-up' : 'angle-down'}
        >
          <Trans i18nKey="time-picker.footer.change-settings-button">Change time settings</Trans>
        </Button>
      </section>
      {isEditing ? (
        <div className={style.editContainer} id={timeSettingsId}>
          <TabsBar>
            <Tab
              label={t('time-picker.footer.time-zone-option', 'Time zone')}
              active={editMode === 'tz'}
              onChangeTab={() => {
                setEditMode('tz');
              }}
              aria-controls={timeZoneSettingsId}
            />
            <Tab
              label={t('time-picker.footer.fiscal-year-option', 'Fiscal year')}
              active={editMode === 'fy'}
              onChangeTab={() => {
                setEditMode('fy');
              }}
              aria-controls={fiscalYearSettingsId}
            />
          </TabsBar>
          <TabContent className={style.noBackground}>
            {editMode === 'tz' ? (
              <section
                role="tabpanel"
                data-testid={selectors.components.TimeZonePicker.containerV2}
                id={timeZoneSettingsId}
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
                  menuShouldPortal={false}
                />
              </section>
            ) : (
              <section
                role="tabpanel"
                data-testid={selectors.components.TimeZonePicker.containerV2}
                id={fiscalYearSettingsId}
                className={cx(style.timeZoneContainer, style.timeSettingContainer)}
              >
                <Field
                  className={style.fiscalYearField}
                  label={t('time-picker.footer.fiscal-year-start', 'Fiscal year start month')}
                >
                  <Combobox
                    value={fiscalYearStartMonth ?? null}
                    options={getMonthOptions()}
                    onChange={(value) => {
                      if (onChangeFiscalYearStartMonth) {
                        onChangeFiscalYearStartMonth(value?.value ?? 0);
                      }
                    }}
                  />
                </Field>
              </section>
            )}
          </TabContent>
        </div>
      ) : null}
    </div>
  );
};

const getStyle = (theme: GrafanaTheme2) => ({
  container: css({
    borderTop: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(1.5),
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  }),
  editContainer: css({
    borderTop: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(1.5),
    paddingTop: 0,
    justifyContent: 'space-between',
    alignItems: 'center',
  }),
  spacer: css({
    marginLeft: '7px',
  }),
  timeSettingContainer: css({
    paddingTop: theme.spacing(1),
  }),
  noBackground: css({
    background: 'inherit',
  }),
  fiscalYearField: css({
    marginBottom: 0,
  }),
  timeZoneContainer: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexGrow: 1,
  }),
  timeZone: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'baseline',
    flexGrow: 1,
  }),
});
