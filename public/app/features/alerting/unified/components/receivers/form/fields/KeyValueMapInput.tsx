import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Input, useStyles2 } from '@grafana/ui';

import { ActionIcon } from '../../../rules/ActionIcon';

interface Props {
  value?: Record<string, string>;
  readOnly?: boolean;
  onChange: (value: Record<string, string>) => void;
}

export const KeyValueMapInput = ({ value, onChange, readOnly = false }: Props) => {
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
              {!readOnly && <th />}
            </tr>
          </thead>
          <tbody>
            {pairs.map(([key, value], index) => (
              <tr key={index}>
                <td>
                  <Input
                    readOnly={readOnly}
                    value={key}
                    onChange={(e) => updatePair([e.currentTarget.value, value], index)}
                  />
                </td>
                <td>
                  <Input
                    readOnly={readOnly}
                    value={value}
                    onChange={(e) => updatePair([key, e.currentTarget.value], index)}
                  />
                </td>
                {!readOnly && (
                  <td>
                    <ActionIcon icon="trash-alt" tooltip="delete" onClick={() => deleteItem(index)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!readOnly && (
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
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  addButton: css({
    marginTop: theme.spacing(1),
  }),
  table: css({
    'tbody td': {
      padding: `0 ${theme.spacing(1)} ${theme.spacing(1)} 0`,
    },
  }),
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
