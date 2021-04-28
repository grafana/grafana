import React, { FC, useEffect, useState } from 'react';
import { NotificationChannelOption } from 'app/types';
import { useFormContext } from 'react-hook-form';
import { GrafanaThemeV2 } from '@grafana/data';
import { css } from '@emotion/css';
import { Button, Input, InputControl, useStyles2 } from '@grafana/ui';
import { CollapsibleSection } from '../CollapsibleSection';
import { ActionIcon } from '../../../rules/ActionIcon';

interface Props {
  option: NotificationChannelOption;
  path: string;
}

export const KeyValueField: FC<Props> = ({ option, path }) => {
  const { control } = useFormContext();
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.wrapper}>
      <CollapsibleSection className={styles.collapsibleSection} label={option.label} description={option.description}>
        <InputControl name={path} as={KeyValueInput} control={control} />
      </CollapsibleSection>
    </div>
  );
};

interface KeyValueInputProps {
  value?: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
}

const KeyValueInput: FC<KeyValueInputProps> = ({ value, onChange }) => {
  const styles = useStyles2(getStyles);
  const [pairs, setPairs] = useState(recordToPairs(value));
  useEffect(() => setPairs(recordToPairs(value)), [value]);

  const emitChange = (pairs: Array<[string, string]>) => {
    onChange(pairsToRecord(pairs));
  };

  const deleteItem = (index: number) => {
    const newPairs = pairs.slice();
    const removed = newPairs.splice(index, 1)[0];
    setPairs(newPairs);
    if (removed[0]) {
      emitChange(newPairs);
    }
  };

  const updatePair = (values: [string, string], index: number) => {
    const old = pairs[index];
    const newPairs = pairs.map((pair, i) => (i === index ? values : pair));
    setPairs(newPairs);
    if (values[0] || old[0]) {
      emitChange(newPairs);
    }
  };

  return (
    <div>
      {!!pairs.length && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Value</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pairs.map(([key, value], index) => (
              <tr key={index}>
                <td>
                  <Input value={key} onChange={(e) => updatePair([e.currentTarget.value, value], index)} />
                </td>
                <td>
                  <Input value={value} onChange={(e) => updatePair([key, e.currentTarget.value], index)} />
                </td>
                <td>
                  <ActionIcon icon="trash-alt" tooltip="delete" onClick={() => deleteItem(index)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Button
        className={styles.addButton}
        type="button"
        variant="secondary"
        icon="plus"
        size="sm"
        onClick={() => setPairs([...pairs, ['', '']])}
      >
        Add
      </Button>
    </div>
  );
};

const getStyles = (theme: GrafanaThemeV2) => ({
  addButton: css`
    margin-top: ${theme.spacing(1)};
  `,
  table: css`
    tbody td {
      padding: 0 ${theme.spacing(1)} ${theme.spacing(1)} 0;
    }
  `,
  collapsibleSection: css`
    margin: 0;
    padding: 0;
  `,
  wrapper: css`
    margin: ${theme.spacing(2, 0)};
    padding: ${theme.spacing(1)};
    border: solid 1px ${theme.colors.border.medium};
    border-radius: ${theme.shape.borderRadius(1)};
  `,
});

const pairsToRecord = (pairs: Array<[string, string]>): Record<string, string> => {
  const record: Record<string, string> = {};
  for (const [key, value] of pairs) {
    if (key) {
      record[key] = value;
    }
  }
  return record;
};

const recordToPairs = (obj?: Record<string, string>): Array<[string, string]> => Object.entries(obj ?? {});
