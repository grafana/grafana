import { css } from '@emotion/css';
import { FormEvent, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Field, IconButton, Input, Modal, Stack, useStyles2 } from '@grafana/ui';

interface Props {
  isOpen: boolean;
  onDismiss: () => void;
  onAdd: (name: string, values: string[]) => void;
}

export function AddVariableDialog({ isOpen, onDismiss, onAdd }: Props) {
  const styles = useStyles2(getStyles);
  const [name, setName] = useState('');
  const [values, setValues] = useState<string[]>(['']);
  const [submitted, setSubmitted] = useState(false);

  const nameInvalid = submitted && name.trim() === '';
  const valuesInvalid = submitted && values.length === 0;

  const reset = () => {
    setName('');
    setValues(['']);
    setSubmitted(false);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    if (name.trim() === '' || values.length === 0) {
      return;
    }

    onAdd(name.trim(), values);
    reset();
  };

  const handleDismiss = () => {
    reset();
    onDismiss();
  };

  const handleValueChange = (index: number, value: string) => {
    setValues((prev) => prev.map((v, i) => (i === index ? value : v)));
  };

  const handleAddValue = () => {
    setValues((prev) => [...prev, '']);
  };

  const handleRemoveValue = (index: number) => {
    setValues((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Modal title={t('explore.add-variable-dialog.title', 'Add variable')} isOpen={isOpen} onDismiss={handleDismiss}>
      <form onSubmit={handleSubmit}>
        <Field
          noMargin
          label={t('explore.add-variable-dialog.name-label', 'Name')}
          invalid={nameInvalid}
          error={nameInvalid ? t('explore.add-variable-dialog.name-required', 'Name is required') : undefined}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder={t('explore.add-variable-dialog.name-placeholder', 'e.g. job')}
            autoFocus
          />
        </Field>

        <Field
          noMargin
          label={t('explore.add-variable-dialog.values-label', 'Values')}
          invalid={valuesInvalid}
          error={
            valuesInvalid
              ? t('explore.add-variable-dialog.values-required', 'At least one value is required')
              : undefined
          }
        >
          <Stack direction="column" gap={1}>
            {values.map((value, index) => (
              <div key={index} className={styles.valueRow}>
                <Input
                  value={value}
                  onChange={(e) => handleValueChange(index, e.currentTarget.value)}
                  placeholder={t('explore.add-variable-dialog.value-placeholder', 'Value')}
                />
                <IconButton
                  name="trash-alt"
                  aria-label={t('explore.add-variable-dialog.remove-value', 'Remove value')}
                  onClick={() => handleRemoveValue(index)}
                />
              </div>
            ))}
            <Button variant="secondary" icon="plus" onClick={handleAddValue} type="button" size="sm">
              <Trans i18nKey="explore.add-variable-dialog.add-value">Add value</Trans>
            </Button>
          </Stack>
        </Field>

        <Modal.ButtonRow>
          <Button variant="secondary" onClick={handleDismiss} type="button">
            <Trans i18nKey="explore.add-variable-dialog.cancel">Cancel</Trans>
          </Button>
          <Button variant="primary" type="submit">
            <Trans i18nKey="explore.add-variable-dialog.submit">Add variable</Trans>
          </Button>
        </Modal.ButtonRow>
      </form>
    </Modal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  valueRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
});
