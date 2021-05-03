import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { NotifierDTO } from 'app/types';
import React, { useMemo, useState } from 'react';
import { css } from '@emotion/css';
import { Alert, Button, Field, InputControl, Select, useStyles2 } from '@grafana/ui';
import { useFormContext, FieldErrors } from 'react-hook-form';
import { ChannelValues, CommonSettingsComponentType } from '../../../types/receiver-form';
import { ChannelOptions } from './ChannelOptions';
import { CollapsibleSection } from './CollapsibleSection';

interface Props<R> {
  defaultValues: R;
  pathPrefix: string;
  notifiers: NotifierDTO[];
  onDuplicate: () => void;
  commonSettingsComponent: CommonSettingsComponentType;

  secureFields?: Record<string, boolean>;
  errors?: FieldErrors<R>;
  onDelete?: () => void;
}

export function ChannelSubForm<R extends ChannelValues>({
  defaultValues,
  pathPrefix,
  onDuplicate,
  onDelete,
  notifiers,
  errors,
  secureFields,
  commonSettingsComponent: CommonSettingsComponent,
}: Props<R>): JSX.Element {
  const styles = useStyles2(getStyles);
  const name = (fieldName: string) => `${pathPrefix}${fieldName}`;
  const { control, watch } = useFormContext();
  const selectedType = watch(name('type')) ?? defaultValues.type; // nope, setting "default" does not work at all.

  const [_secureFields, setSecureFields] = useState(secureFields ?? {});

  const onResetSecureField = (key: string) => {
    if (_secureFields[key]) {
      const updatedSecureFields = { ...secureFields };
      delete updatedSecureFields[key];
      setSecureFields(updatedSecureFields);
    }
  };

  const typeOptions = useMemo(
    (): SelectableValue[] =>
      notifiers.map(({ name, type }) => ({
        label: name,
        value: type,
      })),
    [notifiers]
  );

  const notifier = notifiers.find(({ type }) => type === selectedType);
  // if there are mandatory options defined, optional options will be hidden by a collapse
  // if there aren't mandatory options, all options will be shown without collapse
  const mandatoryOptions = notifier?.options.filter((o) => o.required);
  const optionalOptions = notifier?.options.filter((o) => !o.required);

  return (
    <div className={styles.wrapper}>
      <div className={styles.topRow}>
        <div>
          <InputControl
            name={name('__id')}
            render={({ field }) => <input type="hidden" {...field} />}
            defaultValue={defaultValues.__id}
            control={control}
          />
          <Field label="Contact point type">
            <InputControl
              name={name('type')}
              defaultValue={defaultValues.type}
              render={({ field: { ref, onChange, ...field } }) => (
                <Select {...field} width={37} options={typeOptions} onChange={(value) => onChange(value?.value)} />
              )}
              control={control}
              rules={{ required: true }}
            />
          </Field>
        </div>
        <div className={styles.buttons}>
          <Button size="xs" variant="secondary" type="button" onClick={() => onDuplicate()} icon="copy">
            Duplicate
          </Button>
          {onDelete && (
            <Button size="xs" variant="secondary" type="button" onClick={() => onDelete()} icon="trash-alt">
              Delete
            </Button>
          )}
        </div>
      </div>
      {notifier && (
        <div className={styles.innerContent}>
          <ChannelOptions<R>
            selectedChannelOptions={mandatoryOptions?.length ? mandatoryOptions! : optionalOptions!}
            secureFields={_secureFields}
            errors={errors}
            onResetSecureField={onResetSecureField}
            pathPrefix={pathPrefix}
          />
          {!!(mandatoryOptions?.length && optionalOptions?.length) && (
            <CollapsibleSection label={`Optional ${notifier.name} settings`}>
              {notifier.info !== '' && (
                <Alert title="" severity="info">
                  {notifier.info}
                </Alert>
              )}
              <ChannelOptions<R>
                selectedChannelOptions={optionalOptions!}
                secureFields={_secureFields}
                onResetSecureField={onResetSecureField}
                errors={errors}
                pathPrefix={pathPrefix}
              />
            </CollapsibleSection>
          )}
          <CollapsibleSection label="Notification settings">
            <CommonSettingsComponent pathPrefix={pathPrefix} />
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
