import { css } from '@emotion/css';
import React, { useEffect, useMemo, useState } from 'react';
import { useFormContext, FieldErrors, FieldValues } from 'react-hook-form';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Alert, Button, Field, InputControl, Select, useStyles2 } from '@grafana/ui';
import { NotifierDTO } from 'app/types';

import { useUnifiedAlertingSelector } from '../../../hooks/useUnifiedAlertingSelector';
import { ChannelValues, CommonSettingsComponentType } from '../../../types/receiver-form';

import { ChannelOptions } from './ChannelOptions';
import { CollapsibleSection } from './CollapsibleSection';

interface Props<R extends FieldValues> {
  defaultValues: R;
  pathPrefix: string;
  notifiers: NotifierDTO[];
  onDuplicate: () => void;
  onTest?: () => void;
  commonSettingsComponent: CommonSettingsComponentType;

  secureFields?: Record<string, boolean>;
  errors?: FieldErrors<R>;
  onDelete?: () => void;
  isEditable?: boolean;
  isTestable?: boolean;
}

export function ChannelSubForm<R extends ChannelValues>({
  defaultValues,
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
}: Props<R>): JSX.Element {
  const styles = useStyles2(getStyles);
  const name = (fieldName: string) => `${pathPrefix}${fieldName}`;
  const { control, watch, register, trigger, formState, setValue } = useFormContext();
  const selectedType = watch(name('type')) ?? defaultValues.type; // nope, setting "default" does not work at all.
  const { loading: testingReceiver } = useUnifiedAlertingSelector((state) => state.testReceivers);

  useEffect(() => {
    register(`${pathPrefix}.__id`);
    /* Need to manually register secureFields or else they'll
     be lost when testing a contact point */
    register(`${pathPrefix}.secureFields`);
  }, [register, pathPrefix]);

  const [_secureFields, setSecureFields] = useState(secureFields ?? {});

  const onResetSecureField = (key: string) => {
    if (_secureFields[key]) {
      const updatedSecureFields = { ...secureFields };
      delete updatedSecureFields[key];
      setSecureFields(updatedSecureFields);
      setValue(`${pathPrefix}.secureFields`, updatedSecureFields);
    }
  };

  const typeOptions = useMemo(
    (): SelectableValue[] =>
      notifiers
        .map(({ name, type }) => ({
          label: name,
          value: type,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [notifiers]
  );

  const handleTest = async () => {
    await trigger();
    const isValid = Object.keys(formState.errors).length === 0;

    if (isValid && onTest) {
      onTest();
    }
  };

  const notifier = notifiers.find(({ type }) => type === selectedType);
  // if there are mandatory options defined, optional options will be hidden by a collapse
  // if there aren't mandatory options, all options will be shown without collapse
  const mandatoryOptions = notifier?.options.filter((o) => o.required);
  const optionalOptions = notifier?.options.filter((o) => !o.required);

  const contactPointTypeInputId = `contact-point-type-${pathPrefix}`;

  return (
    <div className={styles.wrapper} data-testid="item-container">
      <div className={styles.topRow}>
        <div>
          <Field label="Contact point type" htmlFor={contactPointTypeInputId} data-testid={`${pathPrefix}type`}>
            <InputControl
              name={name('type')}
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
          {isTestable && onTest && (
            <Button
              disabled={testingReceiver}
              size="xs"
              variant="secondary"
              type="button"
              onClick={() => handleTest()}
              icon={testingReceiver ? 'fa fa-spinner' : 'message'}
            >
              Test
            </Button>
          )}
          {isEditable && (
            <>
              <Button size="xs" variant="secondary" type="button" onClick={() => onDuplicate()} icon="copy">
                Duplicate
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
                  Delete
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      {notifier && (
        <div className={styles.innerContent}>
          <ChannelOptions<R>
            defaultValues={defaultValues}
            selectedChannelOptions={mandatoryOptions?.length ? mandatoryOptions! : optionalOptions!}
            secureFields={_secureFields}
            errors={errors}
            onResetSecureField={onResetSecureField}
            pathPrefix={pathPrefix}
            readOnly={!isEditable}
          />
          {!!(mandatoryOptions?.length && optionalOptions?.length) && (
            <CollapsibleSection label={`Optional ${notifier.name} settings`}>
              {notifier.info !== '' && (
                <Alert title="" severity="info">
                  {notifier.info}
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
              />
            </CollapsibleSection>
          )}
          <CollapsibleSection label="Notification settings">
            <CommonSettingsComponent pathPrefix={pathPrefix} readOnly={!isEditable} />
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  buttons: css`
    & > * + * {
      margin-left: ${theme.spacing(1)};
    }
  `,
  innerContent: css`
    max-width: 536px;
  `,
  wrapper: css`
    margin: ${theme.spacing(2, 0)};
    padding: ${theme.spacing(1)};
    border: solid 1px ${theme.colors.border.medium};
    border-radius: ${theme.shape.borderRadius(1)};
    max-width: ${theme.breakpoints.values.xl}${theme.breakpoints.unit};
  `,
  topRow: css`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  `,
  channelSettingsHeader: css`
    margin-top: ${theme.spacing(2)};
  `,
});
