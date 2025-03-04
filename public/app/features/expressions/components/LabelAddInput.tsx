import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Button, Input, Select, Stack, useStyles2 } from '@grafana/ui';

import { ActionIcon } from '../../alerting/unified/components/rules/ActionIcon';
import { LabelAdd } from '../types';

interface LabelAddInputProps {
  value?: Record<string, LabelAdd>;
  onChange: (value: Record<string, LabelAdd>) => void;
}

interface AddLine {
  key: string;
  type: string;
  value: string;
}

export const LabelAddInput = ({ value, onChange }: LabelAddInputProps) => {
  const styles = useStyles2(getStyles);
  const [pairs, setPairs] = useState(recordToPairs(value));
  const [current, setCurrent] = useState<AddLine | undefined>(undefined);

  const types: Array<SelectableValue<string>> = [
    { label: 'Constant', value: 'constant' },
    { label: 'Template', value: 'template' },
  ];

  const editPair = (index: number, r: AddLine) => {
    const newPairs = pairs.slice();
    newPairs[index] = r;
    setPairs(newPairs);
    emitChange(newPairs);
  };

  const emitChange = (pairs: AddLine[]) => {
    onChange(pairsToRecord(pairs));
  };

  const deleteItem = (index: number) => {
    const newPairs = pairs.slice();
    const removed = newPairs.splice(index, 1);
    setPairs(newPairs);
    if (removed[0]) {
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
              <th>Type</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map(({ key, value, type }: AddLine, index) => (
              <tr key={index}>
                <td>
                  <Input value={key} disabled />
                </td>
                <td>
                  <Select
                    options={types}
                    value={type}
                    onChange={(value) => {
                      editPair(index, {
                        ...pairs[index],
                        type: value.value ?? 'constant',
                        value: '',
                      });
                    }}
                  />
                </td>
                <td>
                  <Input
                    value={value}
                    onChange={(e) =>
                      editPair(index, {
                        ...pairs[index],
                        value: e.currentTarget.value,
                      })
                    }
                  />
                </td>
                <td>
                  <ActionIcon icon="trash-alt" tooltip="Delete" onClick={() => deleteItem(index)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {current && (
        <table className={styles.table}>
          <tr>
            <Stack gap={1}>
              <td>
                <Input
                  value={current.key}
                  onChange={(e) =>
                    setCurrent({
                      ...current,
                      key: e.currentTarget.value,
                    })
                  }
                />
              </td>
              <td>
                <Select
                  options={types}
                  value={current.type}
                  onChange={(value) => {
                    setCurrent({
                      ...current,
                      type: value.value ?? 'constant',
                      value: '',
                    });
                  }}
                />
              </td>
              <td>
                <Input
                  value={current.value}
                  onChange={(e) =>
                    setCurrent({
                      ...current,
                      value: e.currentTarget.value,
                    })
                  }
                />
              </td>
              <td>
                <Stack gap={1}>
                  <ActionIcon
                    icon="check"
                    tooltip="Confirm to add"
                    onClick={() => {
                      setPairs([...pairs, current]);
                      setCurrent(undefined);
                      emitChange([...pairs, current]);
                    }}
                  />
                  <ActionIcon icon="times" tooltip="Cancel" onClick={() => setCurrent(undefined)} />
                </Stack>
              </td>
            </Stack>
          </tr>
        </table>
      )}
      <Button
        className={styles.addButton}
        type="button"
        variant="secondary"
        icon="plus"
        size="sm"
        disabled={!!current}
        onClick={() => setCurrent({ key: '', type: 'constant', value: '' })}
      >
        Add
      </Button>
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

const pairsToRecord = (pairs: AddLine[]): Record<string, LabelAdd> => {
  const record: Record<string, LabelAdd> = {};
  for (const value of pairs) {
    if (value.type === 'constant') {
      record[value.key] = {
        constant: value.value,
        template: null,
      };
      continue;
    }
    if (value.type === 'template') {
      record[value.key] = {
        template: value.value,
        constant: null,
      };
    }
  }
  return record;
};

const recordToPairs = (obj?: Record<string, LabelAdd>): AddLine[] => {
  if (!obj) {
    return [];
  }
  const pairs: AddLine[] = [];
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (!val) {
      continue;
    }
    if (val.constant && val.constant !== '') {
      pairs.push({
        key: key,
        type: 'constant',
        value: val.constant,
      });
      continue;
    }
    if (val.template && val.template !== '') {
      pairs.push({
        key: key,
        type: 'template',
        value: val.template,
      });
    }
  }
  return pairs;
};
