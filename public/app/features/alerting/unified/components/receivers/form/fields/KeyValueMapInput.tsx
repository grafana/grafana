import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Input, Stack, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { ActionIcon } from '../../../rules/ActionIcon';

interface Props {
  value?: Record<string, string>;
  readOnly?: boolean;
  onChange: (value: Record<string, string>) => void;
}

export const KeyValueMapInput = ({ value, onChange, readOnly = false }: Props) => {
  const styles = useStyles2(getStyles);
  const [pairs, setPairs] = useState(recordToPairs(value));
  const [currentNewPair, setCurrentNewPair] = useState<[string, string] | undefined>(undefined);

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

  return (
    <div>
      {!!pairs.length && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>
                <Trans i18nKey="alerting.key-value-map-input.name">Name</Trans>
              </th>
              <th>
                <Trans i18nKey="alerting.key-value-map-input.value">Value</Trans>
              </th>
              {!readOnly && <th />}
            </tr>
          </thead>
          <tbody>
            {pairs.map(([key, value], index) => (
              <tr key={index}>
                <td>
                  <Input readOnly={readOnly} value={key} disabled />
                </td>
                <td>
                  <Input readOnly={readOnly} value={value} disabled />
                </td>
                {!readOnly && (
                  <td>
                    <ActionIcon
                      icon="trash-alt"
                      tooltip={t('alerting.common.delete', 'Delete')}
                      onClick={() => deleteItem(index)}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {currentNewPair && (
        <table className={styles.table}>
          <tr>
            <Stack gap={1}>
              <td>
                <Input
                  value={currentNewPair[0]}
                  onChange={(e) => setCurrentNewPair([e.currentTarget.value, currentNewPair[1]])}
                />
              </td>
              <td>
                <Input
                  value={currentNewPair[1]}
                  onChange={(e) => setCurrentNewPair([currentNewPair[0], e.currentTarget.value])}
                />
              </td>
              <td>
                <Stack gap={1}>
                  <ActionIcon
                    icon="check"
                    tooltip={t('alerting.contact-points.key-value-map.confirm-add', 'Confirm to add')}
                    onClick={() => {
                      setPairs([...pairs, currentNewPair]);
                      setCurrentNewPair(undefined);
                      emitChange([...pairs, currentNewPair]);
                    }}
                  />
                  <ActionIcon
                    icon="times"
                    tooltip={t('alerting.common.cancel', 'Cancel')}
                    onClick={() => setCurrentNewPair(undefined)}
                  />
                </Stack>
              </td>
            </Stack>
          </tr>
        </table>
      )}
      {!readOnly && (
        <Button
          className={styles.addButton}
          type="button"
          variant="secondary"
          icon="plus"
          size="sm"
          disabled={!!currentNewPair}
          onClick={() => setCurrentNewPair(['', ''])}
        >
          <Trans i18nKey="alerting.contact-points.key-value-map.add">Add</Trans>
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
