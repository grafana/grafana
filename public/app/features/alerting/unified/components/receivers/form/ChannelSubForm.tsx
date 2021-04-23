import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { NotifierDTO } from 'app/types';
import React, { useMemo } from 'react';
import { css } from '@emotion/css';
import { Button, Field, InputControl, Select, useStyles } from '@grafana/ui';
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
  const styles = useStyles(getStyles);
  const name = (fieldName: string) => `${pathPrefix}${fieldName}`;
  const { control, watch } = useFormContext();

  const typeOptions = useMemo(
    (): SelectableValue[] =>
      notifiers.map(({ name, type }) => ({
        label: name,
        value: type,
      })),
    [notifiers]
  );

  const values = watch();

  console.log(pathPrefix, defaults, values);

  const selectedType = watch(name('type')) ?? defaults.type;

  const notifier = notifiers.find(({ type }) => type === selectedType);

  console.log('errors', errors);

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
            selectedChannelOptions={notifier.options.filter((o) => o.required)}
            secureFields={{}}
            errors={errors}
            onResetSecureField={() => {}}
            pathPrefix={pathPrefix}
            defaults={defaults as any}
          />
          {notifier.options.filter((o) => !o.required).length > 0 && (
            <div>
              <OptionalChannelOptions
                selectedChannelOptions={notifier.options.filter((o) => !o.required)}
                notifier={notifier}
                secureFields={{}}
                onResetSecureField={() => {}}
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

const getStyles = (theme: GrafanaTheme) => ({
  buttons: css`
    & > * + * {
      margin-left: ${theme.v2.spacing(1)};
    }
  `,
  innerContent: css`
    max-width: 536px;
  `,
  wrapper: css`
    margin: ${theme.v2.spacing(2, 0)};
    padding: ${theme.v2.spacing(1)};
    border: solid 1px ${theme.colors.border2};
    border-radius: ${theme.border.radius.sm};
  `,
  topRow: css`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  `,
});
