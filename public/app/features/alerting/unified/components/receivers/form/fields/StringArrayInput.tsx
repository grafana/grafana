import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Input, useStyles2 } from '@grafana/ui';

import { ActionIcon } from '../../../rules/ActionIcon';

interface Props {
  value?: string[];
  readOnly?: boolean;
  onChange: (value: string[]) => void;
}

export const StringArrayInput = ({ value, onChange, readOnly = false }: Props) => {
  const styles = useStyles2(getStyles);

  const deleteItem = (index: number) => {
    if (!value) {
      return;
    }
    const newValue = value.slice();
    newValue.splice(index, 1);
    onChange(newValue);
  };

  const updateValue = (itemValue: string, index: number) => {
    if (!value) {
      return;
    }
    onChange(value.map((v, i) => (i === index ? itemValue : v)));
  };

  return (
    <div>
      {!!value?.length &&
        value.map((v, index) => (
          <div key={index} className={styles.row}>
            <Input readOnly={readOnly} value={v} onChange={(e) => updateValue(e.currentTarget.value, index)} />
            {!readOnly && (
              <ActionIcon
                className={styles.deleteIcon}
                icon="trash-alt"
                tooltip="delete"
                onClick={() => deleteItem(index)}
              />
            )}
          </div>
        ))}
      {!readOnly && (
        <Button
          className={styles.addButton}
          type="button"
          variant="secondary"
          icon="plus"
          size="sm"
          onClick={() => onChange([...(value ?? []), ''])}
        >
          Add
        </Button>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  row: css`
    display: flex;
    flex-direction: row;
    margin-bottom: ${theme.spacing(1)};
    align-items: center;
  `,
  deleteIcon: css`
    margin-left: ${theme.spacing(1)};
  `,
  addButton: css`
    margin-top: ${theme.spacing(1)};
  `,
});
