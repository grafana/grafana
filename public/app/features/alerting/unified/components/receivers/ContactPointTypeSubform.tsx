import { GrafanaTheme, SelectableValue } from '@grafana/data';
import { NotifierDTO } from 'app/types';
import React, { useMemo } from 'react';
import { css } from '@emotion/css';
import { Button, Field, InputControl, Select, useStyles } from '@grafana/ui';
import { useFormContext } from 'react-hook-form';

interface Props<R> {
  subPath: string;
  notifiers: NotifierDTO[];
  onDelete: () => void;
  onDuplicate: () => void;
  defaults: R;
}

export function ContactPointTypeSubform<R extends { type: string }>({
  subPath,
  onDuplicate,
  onDelete,
  notifiers,
  defaults,
}: Props<R>): JSX.Element {
  const styles = useStyles(getStyles);
  const name = (fieldName: string) => `${subPath}${fieldName}`;
  const { control, watch } = useFormContext();

  const typeOptions = useMemo(
    (): SelectableValue[] =>
      notifiers.map(({ name, type }) => ({
        label: name,
        value: type,
      })),
    [notifiers]
  );

  const selectedType = watch(name('type')) ?? defaults.type;

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
          <Button size="xs" variant="secondary" type="button" onClick={() => onDelete()} icon="trash-alt">
            Delete
          </Button>
        </div>
      </div>
      <div>{selectedType}</div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme) => ({
  buttons: css`
    & > * + * {
      margin-left: ${theme.v2.spacing(1)};
    }
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
