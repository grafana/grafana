import { css } from '@emotion/css';
import { sortBy } from 'lodash';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, FieldErrors, FieldValues, useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Alert, Button, Field, Select, Stack, Text, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { useUnifiedAlertingSelector } from '../../../hooks/useUnifiedAlertingSelector';
import { ChannelValues, CommonSettingsComponentType } from '../../../types/receiver-form';
import { OnCallIntegrationType } from '../grafanaAppReceivers/onCall/useOnCallIntegration';

import { ChannelOptions } from './ChannelOptions';
import { CollapsibleSection } from './CollapsibleSection';
import { Notifier } from './notifiers';

interface Props<R extends FieldValues> {
  defaultValues: R;
  initialValues?: R;
  pathPrefix: string;
  notifiers: Notifier[];
  onDuplicate: () => void;
  onTest?: () => void;
  commonSettingsComponent: CommonSettingsComponentType;

  secureFields?: Record<string, boolean>;
  errors?: FieldErrors<R>;
  onDelete?: () => void;
  isEditable?: boolean;
  isTestable?: boolean;

  customValidators?: React.ComponentProps<typeof ChannelOptions>['customValidators'];
}

export function ChannelSubForm<R extends ChannelValues>({
  defaultValues,
  initialValues,
  pathPrefix,
  onDuplicate,
  onDelete,
  onTest,
  notifiers,
  errors,
  secureFields,
  commonSettingsComponent: CommonSettingsComponent,
  isEditable = true,
  isTestable,
  customValidators = {},
}: Props<R>): JSX.Element {
  const styles = useStyles2(getStyles);

  const fieldName = useCallback((fieldName: string) => `${pathPrefix}${fieldName}`, [pathPrefix]);

  const { control, watch, register, trigger, formState, setValue } = useFormContext();
  const selectedType = watch(fieldName('type')) ?? defaultValues.type; // nope, setting "default" does not work at all.
  const parse_mode = watch(fieldName('settings.parse_mode'));
  const { loading: testingReceiver } = useUnifiedAlertingSelector((state) => state.testReceivers);

  // TODO I don't like integration specific code here but other ways require a bigger refactoring
  const onCallIntegrationType = watch(fieldName('settings.integration_type'));
  const isTestAvailable = onCallIntegrationType !== OnCallIntegrationType.NewIntegration;

  useEffect(() => {
    register(`${pathPrefix}.__id`);
    /* Need to manually register secureFields or else they'll
     be lost when testing a contact point */
    register(`${pathPrefix}.secureFields`);
  }, [register, pathPrefix]);

  // Prevent forgetting about initial values when switching the integration type and the oncall integration type
  useEffect(() => {
    // Restore values when switching back from a changed integration to the default one
    const subscription = watch((v, { name, type }) => {
      const value = name ? v[name] : '';
      if (initialValues && name === fieldName('type') && value === initialValues.type && type === 'change') {
        setValue(fieldName('settings'), initialValues.settings);
      }
      // Restore initial value of an existing oncall integration
      if (
        initialValues &&
        name === fieldName('settings.integration_type') &&
        value === OnCallIntegrationType.ExistingIntegration
      ) {
        setValue(fieldName('settings.url'), initialValues.settings.url);
      }
    });

    return () => subscription.unsubscribe();
  }, [selectedType, initialValues, setValue, fieldName, watch]);

  const [_secureFields, setSecureFields] = useState<Record<string, boolean | ''>>(secureFields ?? {});

  const onResetSecureField = (key: string) => {
    if (_secureFields[key]) {
      const updatedSecureFields = { ..._secureFields };
      updatedSecureFields[key] = '';
      setSecureFields(updatedSecureFields);
      setValue(`${pathPrefix}.secureFields`, updatedSecureFields);
    }
  };

  const typeOptions = useMemo(
    (): SelectableValue[] =>
      sortBy(notifiers, ({ dto, meta }) => [meta?.order ?? 0, dto.name])
        // .notifiers.sort((a, b) => a.dto.name.localeCompare(b.dto.name))
        .map<SelectableValue>(({ dto: { name, type }, meta }) => ({
          // @ts-expect-error ReactNode is supported
          label: (
            <Stack alignItems="center" gap={1}>
              {name}
              {meta?.badge}
            </Stack>
          ),
          value: type,
          description: meta?.description,
          isDisabled: meta ? !meta.enabled : false,
        })),
    [notifiers]
  );

  const handleTest = async () => {
    await trigger();
    const isValid = Object.keys(formState.errors).length === 0;

    if (isValid && onTest) {
      onTest();
    }
  };

  const notifier = notifiers.find(({ dto: { type } }) => type === selectedType);
  const isTelegram = selectedType === 'telegram';
  // Grafana AM takes "None" value and maps to an empty string,
  // Cloud AM takes no value at all
  const isParseModeNone = parse_mode === 'None' || !parse_mode;
  const showTelegramWarning = isTelegram && !isParseModeNone;
  // if there are mandatory options defined, optional options will be hidden by a collapse
  // if there aren't mandatory options, all options will be shown without collapse
  const mandatoryOptions = notifier?.dto.options.filter((o) => o.required);
  const optionalOptions = notifier?.dto.options.filter((o) => !o.required);

  const contactPointTypeInputId = `contact-point-type-${pathPrefix}`;
  return (
    <div className={styles.wrapper} data-testid="item-container">
      <div className={styles.topRow}>
        <div>
          <Field
            label={t('alerting.channel-sub-form.label-integration', 'Integration')}
            htmlFor={contactPointTypeInputId}
            data-testid={`${pathPrefix}type`}
          >
            <Controller
              name={fieldName('type')}
              defaultValue={defaultValues.type}
              render={({ field: { ref, onChange, ...field } }) => (
                <Select
                  disabled={!isEditable}
                  inputId={contactPointTypeInputId}
                  {...field}
                  width={37}
                  options={typeOptions}
                  onChange={(value) => onChange(value?.value)}
                />
              )}
              control={control}
              rules={{ required: true }}
            />
          </Field>
        </div>
        <div className={styles.buttons}>
          {isTestable && onTest && isTestAvailable && (
            <Button
              disabled={testingReceiver}
              size="xs"
              variant="secondary"
              type="button"
              onClick={() => handleTest()}
              icon={testingReceiver ? 'spinner' : 'message'}
            >
              <Trans i18nKey="alerting.channel-sub-form.test">Test</Trans>
            </Button>
          )}
          {isEditable && (
            <>
              <Button size="xs" variant="secondary" type="button" onClick={() => onDuplicate()} icon="copy">
                <Trans i18nKey="alerting.channel-sub-form.duplicate">Duplicate</Trans>
              </Button>
              {onDelete && (
                <Button
                  data-testid={`${pathPrefix}delete-button`}
                  size="xs"
                  variant="secondary"
                  type="button"
                  onClick={() => onDelete()}
                  icon="trash-alt"
                >
                  <Trans i18nKey="alerting.channel-sub-form.delete">Delete</Trans>
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      {notifier && (
        <div className={styles.innerContent}>
          {showTelegramWarning && (
            <Alert
              title={t(
                'alerting.contact-points.telegram.parse-mode-warning-title',
                'Telegram messages are limited to 4096 UTF-8 characters.'
              )}
              severity="warning"
            >
              <Trans i18nKey="alerting.contact-points.telegram.parse-mode-warning-body">
                If you use a <Text variant="code">parse_mode</Text> option other than <Text variant="code">None</Text>,
                truncation may result in an invalid message, causing the notification to fail. For longer messages, we
                recommend using an alternative contact method.
              </Trans>
            </Alert>
          )}
          <ChannelOptions<R>
            defaultValues={defaultValues}
            selectedChannelOptions={mandatoryOptions?.length ? mandatoryOptions! : optionalOptions!}
            secureFields={_secureFields}
            errors={errors}
            onResetSecureField={onResetSecureField}
            pathPrefix={pathPrefix}
            readOnly={!isEditable}
            customValidators={customValidators}
          />
          {!!(mandatoryOptions?.length && optionalOptions?.length) && (
            <CollapsibleSection label={`Optional ${notifier.dto.name} settings`}>
              {notifier.dto.info !== '' && (
                <Alert title="" severity="info">
                  {notifier.dto.info}
                </Alert>
              )}
              <ChannelOptions<R>
                defaultValues={defaultValues}
                selectedChannelOptions={optionalOptions!}
                secureFields={_secureFields}
                onResetSecureField={onResetSecureField}
                errors={errors}
                pathPrefix={pathPrefix}
                readOnly={!isEditable}
                customValidators={customValidators}
              />
            </CollapsibleSection>
          )}
          <CollapsibleSection
            label={t('alerting.channel-sub-form.label-notification-settings', 'Notification settings')}
          >
            <CommonSettingsComponent pathPrefix={pathPrefix} readOnly={!isEditable} />
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  buttons: css({
    '& > * + *': {
      marginLeft: theme.spacing(1),
    },
  }),
  innerContent: css({
    maxWidth: '536px',
  }),
  wrapper: css({
    margin: theme.spacing(2, 0),
    padding: theme.spacing(1),
    border: `solid 1px ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
  }),
  topRow: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  }),
  channelSettingsHeader: css({
    marginTop: theme.spacing(2),
  }),
});
