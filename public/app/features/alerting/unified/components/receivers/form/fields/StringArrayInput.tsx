import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Input, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

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
                tooltip={t('alerting.string-array-input.tooltip-delete', 'delete')}
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
          <Trans i18nKey="alerting.string-array-input.add">Add</Trans>
        </Button>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    display: 'flex',
    flexDirection: 'row',
    marginBottom: theme.spacing(1),
    alignItems: 'center',
  }),
  deleteIcon: css({
    marginLeft: theme.spacing(1),
  }),
  addButton: css({
    marginTop: theme.spacing(1),
  }),
});
