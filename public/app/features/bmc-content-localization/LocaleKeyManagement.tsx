/* eslint-disable @emotion/syntax-preference */
import { css, cx } from '@emotion/css';
import { size } from 'lodash';
import { FC, useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { AppEvents, GrafanaTheme2 } from '@grafana/data';
import { Button, Drawer, Field, Icon, InlineLabel, Input, Select, Stack, useStyles2, useTheme2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { t, Trans } from 'app/core/internationalization';
import { ENGLISH_US } from 'app/core/internationalization/constants';

import { DashboardModel } from '../dashboard/state/DashboardModel';

import { DashboardLocale, initializeDashboardLocale, LanguageCode, LanguageOptions } from './types';

const MAX_LENGTH = 255;

interface Props {
  dashboard: Partial<DashboardModel>;
  globalMode?: boolean;
  defaultKey: string;
  ControlOption?: React.FC;
  MAX_KEY_LENGTH?: number;
}

export const LocaleKeyManagement: FC<Props> = ({
  dashboard,
  globalMode = false,
  defaultKey,
  ControlOption,
  MAX_KEY_LENGTH = 1000,
}) => {
  const dashLocales = dashboard.getDashLocales?.() || initializeDashboardLocale();
  const [isSideDrawerOpen, setSideDrawerState] = useState(false);
  const [stateRetrigger, setStateRetrigger] = useState(false);

  const styles = useStyles2(getStyles);
  const [language, setLanguage] = useState<LanguageCode>(ENGLISH_US);
  const handleLanguageChange = (value: LanguageCode) => {
    setLanguage(value);
  };

  const addLocaleKey = useCallback(
    (key: string, val: string): string => {
      if (dashLocales[defaultKey as keyof DashboardLocale][key] !== undefined) {
        return 'key is already present';
      }
      if (size(dashLocales[defaultKey as keyof DashboardLocale]) >= MAX_KEY_LENGTH) {
        return 'Max limit reached';
      }
      Object.keys(dashLocales).map((k) => {
        const localeObj = dashLocales[k as keyof DashboardLocale];
        localeObj[key] = '';
      });
      dashLocales[defaultKey as keyof DashboardLocale][key] = val;
      dashboard.updateLocalesChanges?.(dashLocales);
      setStateRetrigger(!stateRetrigger);
      return '';
    },
    [dashLocales, dashboard, stateRetrigger, defaultKey, MAX_KEY_LENGTH]
  );

  const updateLocalKey = useCallback(
    (curKey: string, prevKey: string) => {
      Object.keys(dashLocales).map((k) => {
        const localeObj = dashLocales[k as keyof DashboardLocale];
        localeObj[curKey] = localeObj[prevKey];
        delete localeObj[prevKey];
      });
      dashboard.updateLocalesChanges?.(dashLocales);
      setStateRetrigger(!stateRetrigger);
    },
    [dashLocales, dashboard, stateRetrigger]
  );

  const updateLocaleVal = useCallback(
    (key: string, newVal: string) => {
      dashLocales[language][key] = newVal;
      dashboard.updateLocalesChanges?.(dashLocales);
      setStateRetrigger(!stateRetrigger);
    },
    [dashLocales, dashboard, language, stateRetrigger]
  );

  const deleteLocaleKey = useCallback(
    (key: string) => {
      Object.keys(dashLocales).map((k) => {
        const localeObj = dashLocales[k as keyof DashboardLocale];
        delete localeObj[key];
      });
      dashboard.updateLocalesChanges?.(dashLocales);
      setStateRetrigger(!stateRetrigger);
    },
    [dashLocales, dashboard, stateRetrigger]
  );

  return (
    <>
      <div className={styles.form}>
        <div className={styles.header}>
          <Select
            className={styles.select}
            options={LanguageOptions()}
            onChange={(e) => handleLanguageChange(e.value as LanguageCode)}
            value={language}
            width={25}
          />
          {ControlOption ? <ControlOption /> : null}
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>
                  <Trans i18nKey="bmc.manage-locales.dashboards.key-text">Key</Trans>
                </th>
                <th className={styles.th}>
                  <Trans i18nKey="bmc.manage-locales.dashboards.value-text">Value</Trans>
                </th>
                <th className={styles.action_th}></th>
              </tr>
            </thead>
            <tbody>
              {/* Mandate name key */}
              {!globalMode ? (
                <tr key={'dash-name'}>
                  <td className={styles.td}>
                    <Input
                      type="text"
                      value={t('bmc.manage-locales.dashboards.dashboard-name', 'Dashboard name')}
                      placeholder={t('bmc.manage-locales.dashboards.enter-key', 'Enter key')}
                      className={styles.input}
                      disabled={true}
                    />
                  </td>
                  <td className={styles.td}>
                    <InputWrapper
                      onBlur={(curVal: string, _: string) => {
                        updateLocaleVal('name', curVal);
                      }}
                      value={dashLocales[language].name ?? ''}
                      placeholder={dashboard.title!}
                    />
                  </td>
                  <td className={styles.td}>
                    <Icon className={styles.disabledIcon} name="trash-alt" title="Delete" />
                  </td>
                </tr>
              ) : null}
              {Object.keys(dashLocales[language]).map((key, index) => {
                return key !== 'name' ? (
                  <tr key={`${key}-${index}`} className={styles.rows}>
                    <td className={styles.td}>
                      <InputWrapper
                        nullable={false}
                        pattern="a-z0-9_"
                        value={key}
                        placeholder={t('bmc.manage-locales.dashboards.enter-key', 'Enter key')}
                        className={styles.input}
                        onBlur={updateLocalKey}
                      />
                    </td>
                    <td className={styles.td}>
                      <InputWrapper
                        onBlur={(curVal: string, _: string) => {
                          updateLocaleVal(key, curVal);
                        }}
                        value={dashLocales[language][key]}
                        placeholder={dashLocales[defaultKey as keyof DashboardLocale][key]}
                      />
                    </td>
                    <td className={cx(styles.td, styles.td_icon)}>
                      <Icon
                        className={styles.icon}
                        name="trash-alt"
                        title={t('bmc.common.delete', 'Delete')}
                        onClick={() => {
                          deleteLocaleKey(key);
                        }}
                      />
                    </td>
                  </tr>
                ) : null;
              })}
            </tbody>
          </table>
        </div>
        <div className={styles.footer}>
          <Button
            onClick={() => {
              setSideDrawerState(true);
            }}
          >
            <Trans i18nKey="bmc.manage-locales.new-key">New key</Trans>
          </Button>
        </div>
      </div>
      {isSideDrawerOpen ? <SideDrawer closeModal={setSideDrawerState} addLocalekey={addLocaleKey} /> : null}
    </>
  );
};

type SideDrawerProps = {
  closeModal: Function;
  addLocalekey: (key: string, value: string) => string;
};

const SideDrawer: FC<SideDrawerProps> = ({ closeModal, addLocalekey }) => {
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm({
    defaultValues: {
      key: '',
      val: '',
    },
  });
  return (
    <Drawer
      size="md"
      title={t('bmc.manage-locales.dashboards.add-key', 'Add new key')}
      onClose={() => {
        closeModal(false);
      }}
      closeOnMaskClick={false}
    >
      <form
        onSubmit={handleSubmit((values) => {
          const msg = addLocalekey(values.key, values.val);
          if (msg !== '') {
            appEvents.emit(AppEvents.alertWarning, [msg]);
          } else {
            closeModal(false);
          }
        })}
      >
        <Stack direction={'column'}>
          <Field
            label={t('bmc.manage-locales.dashboards.enter-key', 'Enter key')}
            description={t('bmc.manage-locales.dashboards.key-validation', 'Only aplhanumeric characters allowed')}
            invalid={!!errors.key}
            error={errors?.key?.message}
          >
            <Input
              {...register('key', {
                required: t('bmc.manage-locales.dashboards.validation.key-required', 'key is required'),
                validate: (v) => {
                  return /^[a-z0-9]+$/i.test(v);
                },
                maxLength: MAX_LENGTH,
              })}
              type="text"
            />
          </Field>
          <Field
            label={t('bmc.manage-locales.dashboards.enter-value', 'Enter value')}
            invalid={!!errors.val}
            error={errors?.val?.message}
          >
            <Input
              {...register('val', {
                required: t(
                  'bmc.manage-locales.dashboards.validation.default-value-required',
                  'default value is required'
                ),
                maxLength: MAX_LENGTH,
              })}
              type="text"
            />
          </Field>
        </Stack>
        <Stack>
          <Button variant="primary" type="submit">
            <Trans i18nKey="bmc.manage-locales.dashboards.add">Add</Trans>
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              closeModal(false);
            }}
          >
            <Trans i18nKey="bmc.manage-locales.cancel">Cancel</Trans>
          </Button>
        </Stack>
      </form>
    </Drawer>
  );
};

type InputProps = {
  value: string;
  placeholder: string;
  className?: string;
  onBlur?: Function;
  nullable?: boolean;
  pattern?: string;
};
const InputWrapper: FC<InputProps> = (props) => {
  const [origVal, setOrigVal] = useState(props.value);
  const [curVal, setCurVal] = useState(props.value);
  const [inlineErr, setInlineErr] = useState('');
  const theme = useTheme2();
  useEffect(() => {
    setOrigVal(props.value);
    setCurVal(props.value);
  }, [props.value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (props.nullable === false && e.currentTarget.value === '') {
        return setInlineErr(t('bmc.manage-locales.dashboards.no-empty-key', "key can't be set empty"));
      }
      setInlineErr('');
      const val = e.currentTarget.value.replace(props.pattern ? new RegExp(`[^${props.pattern}]`, 'i') : '', '');
      if (val.length <= MAX_LENGTH) {
        setCurVal(val);
      }
    },
    [props.nullable, props.pattern]
  );
  return (
    <>
      <Input
        type="text"
        value={curVal}
        maxLength={MAX_LENGTH}
        onChange={handleChange}
        onBlur={() => {
          setInlineErr('');
          if (curVal !== origVal) {
            props.onBlur?.(curVal, origVal);
          }
        }}
        placeholder={props.placeholder}
        className={props.className}
      />
      {inlineErr ? (
        <InlineLabel
          className={css`
            color: ${theme.colors.error.border};
            font-size: 10px;
            height: 20px;
            background: transparent;
          `}
        >
          {inlineErr}
        </InlineLabel>
      ) : null}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  title: css`
    margin-left: 10px;
    margin-top: 10px;
    padding: 6px;
    font-size: 20px;
  `,
  icon: css`
    cursor: pointer;
    color: #555;
    font-size: 20px;
  `,
  form: css`
    text-align: left;
  `,
  header: css`
    display: flex;
    justify-content: space-between;
    width: 100%;
    margin-bottom: ${theme.spacing(2.5)};
  `,
  footer: css`
    display: flex;
    justify-content: space-between;
    padding: ${theme.spacing(2)};
    background: ${theme.colors.background.primary};
    border-top: 1px solid ${theme.colors.border.weak};
    padding-left: 0;
  `,
  tableWrapper: css`
    max-height: 55vh;
    overflow-y: auto;
    margin-bottom: 20px;
  `,
  table: css`
    width: 100%;
    border-collapse: collapse;
  `,
  th: css`
    padding: ${theme.spacing(1)};
    background-color: ${theme.colors.background.secondary};
    font-weight: bold;
  `,
  action_th: css`
    padding: ${theme.spacing(1)};
    background-color: ${theme.colors.background.secondary};
    text-align: center;
    font-weight: bold;
    width: 5%;
  `,
  rows: css`
    vertical-align: top;
  `,
  td: css`
    padding: ${theme.spacing(1)} ${theme.spacing(1)} ${theme.spacing(1)} 0;
    text-align: center;
  `,
  td_icon: css`
    padding-top: ${theme.spacing(1.75)};
  `,
  input: css`
    width: 100%;
    color: #00008b;
    font-size: 14px;
  `,
  errorInput: css`
    border-color: red;
  `,
  select: css`
    height: 30px;
    padding: 6px;
    border-radius: 4px;
    font-size: 14px;
    font-width: bold;
  `,
  disabledIcon: css`
    cursor: not-allowed;
    color: #ccc;
    pointer-events: none;
    opacity: 0.5;
  `,
});
