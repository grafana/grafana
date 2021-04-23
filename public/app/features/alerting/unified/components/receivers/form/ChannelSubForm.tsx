import { GrafanaThemeV2, SelectableValue } from '@grafana/data';
import { NotifierDTO } from 'app/types';
import React, { useEffect, useMemo, useState } from 'react';
import { css } from '@emotion/css';
import { Button, Field, InputControl, Select, useStyles2 } from '@grafana/ui';
import { useFormContext, FieldError, NestDataObject } from 'react-hook-form';
import { ChannelValues } from '../../../types/receiver-form';
import { ChannelOptions } from './ChannelOptions';
import { OptionalChannelOptions } from './OptionalChannelOptions';

interface Props<R> {
  pathPrefix: string;
  notifiers: NotifierDTO[];
  onDuplicate: () => void;
  defaults: R;

  errors?: NestDataObject<R, FieldError>;
  onDelete?: () => void;
}

export function ChannelSubForm<R extends ChannelValues>({
  pathPrefix,
  onDuplicate,
  onDelete,
  notifiers,
  defaults,
  errors,
}: Props<R>): JSX.Element {
  const styles = useStyles2(getStyles);
  const name = (fieldName: string) => `${pathPrefix}${fieldName}`;
  const { control, watch, register, unregister } = useFormContext();

  // keep the __id field registered so it's always passed to submit
  useEffect(() => {
    register({ name: `${pathPrefix}__id`, value: defaults.__id });
    return () => {
      unregister(`${pathPrefix}__id`);
    };
  });

  const [secureFields, setSecureFields] = useState(defaults.secureFields);

  const onResetSecureField = (key: string) => {
    if (secureFields[key]) {
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

  const selectedType = watch(name('type')) ?? defaults.type;

  const notifier = notifiers.find(({ type }) => type === selectedType);
  // if there are mandatory options defined, optional options will be hidden by a collapse
  // if there aren't mandatory options, all options will be shown without collapse
  const mandatoryOptions = notifier?.options.filter((o) => o.required);
  const optionalOptions = notifier?.options.filter((o) => !o.required);

  return (
    <div className={styles.wrapper}>
      <div className={styles.topRow}>
        <div>
          <Field label="Contact point type">
            <InputControl
              name={name('type')}
              as={Select}
              width={37}
              options={typeOptions}
              control={control}
              defaultValue={defaults.type}
              rules={{ required: true }}
              onChange={(values) => values[0]?.value}
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
            secureFields={secureFields}
            errors={errors}
            onResetSecureField={onResetSecureField}
            pathPrefix={pathPrefix}
            defaults={defaults as any}
          />
          {!!(mandatoryOptions?.length && optionalOptions?.length) && (
            <div>
              <OptionalChannelOptions
                selectedChannelOptions={optionalOptions!}
                notifier={notifier}
                secureFields={secureFields}
                onResetSecureField={onResetSecureField}
                errors={errors}
                pathPrefix={pathPrefix}
                defaults={defaults as any}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaThemeV2) => ({
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
  `,
  topRow: css`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  `,
});
