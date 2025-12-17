import { css } from '@emotion/css';
import { sortBy } from 'lodash';
import * as React from 'react';
import { type JSX, useEffect, useMemo } from 'react';
import { Controller, FieldErrors, useFormContext } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Badge, Button, Field, Select, Stack, Text, useStyles2 } from '@grafana/ui';
import { NotificationChannelOption } from 'app/features/alerting/unified/types/alerting';

import {
  ChannelValues,
  CloudChannelValues,
  CommonSettingsComponentType,
  GrafanaChannelValues,
  ReceiverFormValues,
} from '../../../types/receiver-form';
import { isDeprecatedVersion } from '../../../utils/integration-versions';
import { getLatestVersions } from '../../../utils/notifier-versions';
import { OnCallIntegrationType } from '../grafanaAppReceivers/onCall/useOnCallIntegration';

import { ChannelOptions } from './ChannelOptions';
import { CollapsibleSection } from './CollapsibleSection';
import { Notifier } from './notifiers';

interface Props<R extends ChannelValues> {
  defaultValues: R;
  initialValues?: R;
  pathPrefix: `items.${number}.`;
  integrationIndex: number;
  notifiers: Notifier[];
  onDuplicate: () => void;
  onTest?: () => void;
  commonSettingsComponent: CommonSettingsComponentType;
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
  integrationIndex,
  onDuplicate,
  onDelete,
  onTest,
  notifiers,
  errors,
  commonSettingsComponent: CommonSettingsComponent,
  isEditable = true,
  isTestable,
  customValidators = {},
}: Props<R>): JSX.Element {
  const styles = useStyles2(getStyles);
  const { control, watch, register, trigger, formState, setValue, getValues } =
    useFormContext<ReceiverFormValues<CloudChannelValues | GrafanaChannelValues>>();

  const channelFieldPath = `items.${integrationIndex}` as const;
  const typeFieldPath = `${channelFieldPath}.type` as const;
  const settingsFieldPath = `${channelFieldPath}.settings` as const;
  const secureFieldsPath = `${channelFieldPath}.secureFields` as const;

  const selectedType = watch(typeFieldPath) ?? defaultValues.type;
  const parse_mode = watch(`${settingsFieldPath}.parse_mode`);

  // TODO I don't like integration specific code here but other ways require a bigger refactoring
  const onCallIntegrationType = watch(`${settingsFieldPath}.integration_type`);
  const isTestAvailable = onCallIntegrationType !== OnCallIntegrationType.NewIntegration;

  useEffect(() => {
    register(`${channelFieldPath}.__id`);
    /* Need to manually register secureFields or else they'll
     be lost when testing a contact point */
    register(`${channelFieldPath}.secureFields`);
  }, [register, channelFieldPath]);

  // Prevent forgetting about initial values when switching the integration type and the oncall integration type
  useEffect(() => {
    // Restore values when switching back from a changed integration to the default one
    const subscription = watch((formValues, { name, type }) => {
      // @ts-expect-error name is valid key for formValues
      const value = name ? getValues(name, formValues) : '';
      if (initialValues && name === typeFieldPath && value === initialValues.type && type === 'change') {
        setValue(settingsFieldPath, initialValues.settings);
        setValue(secureFieldsPath, initialValues.secureFields);
      } else if (name === typeFieldPath && type === 'change') {
        // When switching to a new notifier, set the default settings to remove all existing settings
        // from the previous notifier
        const newNotifier = notifiers.find(({ dto: { type } }) => type === value);
        const defaultNotifierSettings = newNotifier ? getDefaultNotifierSettings(newNotifier) : {};

        // Not sure why, but verriding settingsFieldPath is not enough if notifiers have the same settings fields, like url, title
        const currentSettings = getValues(settingsFieldPath) ?? {};
        Object.keys(currentSettings).forEach((key) => {
          if (!defaultNotifierSettings[key]) {
            setValue(`${settingsFieldPath}.${key}`, defaultNotifierSettings[key]);
          }
        });

        setValue(settingsFieldPath, defaultNotifierSettings);
        setValue(secureFieldsPath, {});
      }

      // Restore initial value of an existing oncall integration
      if (
        initialValues &&
        name === `${settingsFieldPath}.integration_type` &&
        value === OnCallIntegrationType.ExistingIntegration
      ) {
        setValue(`${settingsFieldPath}.url`, initialValues.settings.url);
      }
    });

    return () => subscription.unsubscribe();
  }, [
    selectedType,
    initialValues,
    setValue,
    settingsFieldPath,
    typeFieldPath,
    secureFieldsPath,
    getValues,
    watch,
    defaultValues.settings,
    defaultValues.secureFields,
    notifiers,
  ]);

  const onResetSecureField = (key: string) => {
    // formSecureFields might not be up to date if this function is called multiple times in a row
    const currentSecureFields = getValues(`${channelFieldPath}.secureFields`);
    if (currentSecureFields[key]) {
      setValue(`${channelFieldPath}.secureFields`, { ...currentSecureFields, [key]: '' });
    }
  };

  const findSecureFieldsRecursively = (options: NotificationChannelOption[]): string[] => {
    const secureFields: string[] = [];
    options?.forEach((option) => {
      if (option.secure && option.secureFieldKey) {
        secureFields.push(option.secureFieldKey);
      }
      if (option.subformOptions) {
        secureFields.push(...findSecureFieldsRecursively(option.subformOptions));
      }
    });
    return secureFields;
  };

  const onDeleteSubform = (settingsPath: string, option: NotificationChannelOption) => {
    // Get all subform options with secure=true recursively.
    const relatedSecureFields = findSecureFieldsRecursively(option.subformOptions ?? []);
    relatedSecureFields.forEach((key) => {
      onResetSecureField(key);
    });
    const fieldPath = settingsPath.startsWith(`${channelFieldPath}.settings.`)
      ? settingsPath.slice(`${channelFieldPath}.settings.`.length)
      : settingsPath;
    setValue(`${settingsFieldPath}.${fieldPath}`, undefined);
  };

  const typeOptions = useMemo((): SelectableValue[] => {
    // Group notifiers by name to handle versioning
    // Only show latest (creatable) versions in the dropdown
    const notifierDTOs = notifiers.map((n) => n.dto);
    const latestVersions = getLatestVersions(notifierDTOs);

    // Create a map of latest version types to their notifier objects
    const latestVersionsMap = new Map(latestVersions.map((dto) => [dto.type, dto]));

    // Filter notifiers to include:
    // 1. Latest versions (v1) - available for creation
    // 2. Currently selected type - even if it's a legacy version (v0)
    //    This ensures editing an existing v0 integration shows its type instead of "Choose"
    const notifiersToShow = notifiers.filter(
      (notifier) => latestVersionsMap.has(notifier.dto.type) || notifier.dto.type === selectedType
    );

    return sortBy(notifiersToShow, ({ dto, meta }) => [meta?.order ?? 0, dto.name]).map<SelectableValue>(
      ({ dto: { name, type, currentVersion }, meta }) => {
        // Add version suffix to distinguish between v0 and v1 of the same integration
        // Example: "Slack (v0)" vs "Slack" when editing a legacy integration
        const versionSuffix = currentVersion && currentVersion !== 'v1' ? ` (${currentVersion})` : '';
        const labelText = `${name}${versionSuffix}`;

        return {
          // ReactNode is supported in Select label, but types don't reflect it
          /* eslint-disable @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any */
          label: (
            <Stack alignItems="center" gap={1}>
              {labelText}
              {meta?.badge}
            </Stack>
          ) as any,
          /* eslint-enable @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any */
          value: type,
          description: meta?.description,
          isDisabled: meta ? !meta.enabled : false,
        };
      }
    );
  }, [notifiers, selectedType]);

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
  const mandatoryOptions = notifier?.dto.options.filter((o) => o.required) ?? [];
  const optionalOptions = notifier?.dto.options.filter((o) => !o.required) ?? [];

  // Check if current integration is a legacy/Mimir version (v0)
  // Legacy integrations are read-only and cannot be edited
  // Read version from existing integration data, not from notifier list
  const integrationVersion = initialValues?.version || defaultValues.version || notifier?.dto.currentVersion;
  const isLegacyVersion = isDeprecatedVersion(integrationVersion);

  const contactPointTypeInputId = `contact-point-type-${pathPrefix}`;
  return (
    <div className={styles.wrapper} data-testid="item-container">
      <div className={styles.topRow}>
        <div>
          <Field
            label={t('alerting.channel-sub-form.label-integration', 'Integration')}
            htmlFor={contactPointTypeInputId}
            data-testid={`${pathPrefix}type`}
            noMargin
          >
            <Stack direction="column" gap={1}>
              <Stack direction="row" alignItems="flex-start" gap={1}>
                <Controller
                  name={typeFieldPath}
                  control={control}
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
                />
              </Stack>
              {isLegacyVersion && integrationVersion && (
                <Stack direction="row" gap={0.5}>
                  <Badge
                    text={t('alerting.channel-sub-form.badge-legacy-mimir', 'Legacy (Mimir)')}
                    color="orange"
                    icon="exclamation-triangle"
                    tooltip={t(
                      'alerting.channel-sub-form.tooltip-legacy-mimir',
                      'This is a legacy integration imported from Mimir. Settings are read-only but you can change to a different integration type to convert.'
                    )}
                  />
                  <Badge
                    text={integrationVersion.toUpperCase()}
                    color="orange"
                    tooltip={t('alerting.channel-sub-form.tooltip-version', 'Integration version: {{version}}', {
                      version: integrationVersion,
                    })}
                  />
                </Stack>
              )}
            </Stack>
          </Field>
        </div>
        <div className={styles.buttons}>
          {/* Don't show Test, Duplicate, or Delete buttons for legacy (v0) integrations */}
          {isTestable && onTest && isTestAvailable && !isLegacyVersion && (
            <Button size="xs" variant="secondary" type="button" onClick={() => handleTest()} icon="message">
              <Trans i18nKey="alerting.channel-sub-form.test">Test</Trans>
            </Button>
          )}
          {isEditable && (
            <>
              {!isLegacyVersion && (
                <Button size="xs" variant="secondary" type="button" onClick={() => onDuplicate()} icon="copy">
                  <Trans i18nKey="alerting.channel-sub-form.duplicate">Duplicate</Trans>
                </Button>
              )}
              {onDelete && !isLegacyVersion && (
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
          {isLegacyVersion && (
            <Alert
              title={t('alerting.channel-sub-form.legacy-read-only-title', 'Legacy Integration - Read Only')}
              severity="info"
            >
              <Trans i18nKey="alerting.channel-sub-form.legacy-read-only-body">
                This integration was imported from Mimir and is currently in read-only mode. To edit or update this
                integration, you will need to convert it to the latest version first.
              </Trans>
            </Alert>
          )}
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
            selectedChannelOptions={mandatoryOptions.length ? mandatoryOptions : optionalOptions}
            errors={errors}
            onResetSecureField={onResetSecureField}
            onDeleteSubform={onDeleteSubform}
            integrationPrefix={channelFieldPath}
            readOnly={!isEditable || isLegacyVersion}
            customValidators={customValidators}
          />
          {!!(mandatoryOptions.length && optionalOptions.length) && (
            <CollapsibleSection
              label={t('alerting.channel-sub-form.label-section', 'Optional {{name}} settings', {
                name: notifier.dto.name,
              })}
            >
              {notifier.dto.info !== '' && (
                <Alert title="" severity="info">
                  {notifier.dto.info}
                </Alert>
              )}
              <ChannelOptions<R>
                defaultValues={defaultValues}
                selectedChannelOptions={optionalOptions}
                onResetSecureField={onResetSecureField}
                onDeleteSubform={onDeleteSubform}
                errors={errors}
                integrationPrefix={channelFieldPath}
                readOnly={!isEditable || isLegacyVersion}
                customValidators={customValidators}
              />
            </CollapsibleSection>
          )}
          <CollapsibleSection
            label={t('alerting.channel-sub-form.label-notification-settings', 'Notification settings')}
          >
            <CommonSettingsComponent pathPrefix={pathPrefix} readOnly={!isEditable || isLegacyVersion} />
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}

function getDefaultNotifierSettings(notifier: Notifier): Record<string, string> {
  const defaultSettings: Record<string, string> = {};
  notifier.dto.options.forEach((option) => {
    if (option.defaultValue?.value) {
      defaultSettings[option.propertyName] = option.defaultValue?.value;
    }
  });
  return defaultSettings;
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
