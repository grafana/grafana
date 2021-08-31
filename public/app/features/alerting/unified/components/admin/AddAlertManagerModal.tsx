import React, { FC, useMemo } from 'react';
import { css, cx } from '@emotion/css';
import { useDispatch } from 'react-redux';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, FieldArray, Form, Icon, Input, Modal, useStyles2 } from '@grafana/ui';
import { addExternalAlertmanagers } from '../../state/actions';

interface Props {
  onClose: () => void;
}

export const AddAlertManagerModal: FC<Props> = ({ onClose }) => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const defaultValues: { alertmanagers: Array<{ url: string }> } = useMemo(() => {
    return {
      alertmanagers: [
        {
          url: '',
        },
      ],
    };
  }, []);

  const modalTitle = (
    <div className={styles.modalTitle}>
      <Icon name="bell" className={styles.modalIcon} />
      <h3>Add Alertmanager</h3>
    </div>
  );

  const onSubmit = (values: Record<string, any>) => {
    dispatch(addExternalAlertmanagers(values.alertmanagers));
    onClose();
  };

  return (
    <Modal title={modalTitle} isOpen={true} onDismiss={onClose} className={styles.modal}>
      <div className={styles.description}>
        We use a service discovery method to find existing Alertmanagers for a given URL.
      </div>
      <Form onSubmit={onSubmit} defaultValues={defaultValues}>
        {({ register, control }) => (
          <div>
            <FieldArray control={control} name="alertmanagers">
              {({ fields, append }) => (
                <div className={styles.fieldArray}>
                  <div className={styles.bold}>Source url</div>
                  <div className={styles.muted}>Auth can be done via URL, eg. user:password@url</div>
                  {fields.map((field, index) => (
                    <div className={styles.inputRow} key={`${field}-${index}`}>
                      <Input
                        className={styles.input}
                        defaultValue={field.url}
                        {...register(`alertmanagers.${index}`)}
                        placeholder="admin:admin@some.url.dev"
                      />
                      <Button variant="destructive" className={styles.destroyInputRow}>
                        <Icon name="trash-alt" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="secondary" onClick={() => append({ url: '' })}>
                    Add URL
                  </Button>
                </div>
              )}
            </FieldArray>
            <div>
              <Button onSubmit={onSubmit}>Add Alertmanagers</Button>
            </div>
          </div>
        )}
      </Form>
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  const muted = css`
    color: ${theme.colors.text.secondary};
  `;
  return {
    description: cx(
      css`
        margin-bottom: ${theme.spacing(2)};
      `,
      muted
    ),
    muted: muted,
    bold: css`
      font-weight: ${theme.typography.fontWeightBold};
    `,
    modal: css``,
    modalIcon: cx(
      muted,
      css`
        margin-right: ${theme.spacing(1)};
      `
    ),
    modalTitle: css`
      display: flex;
    `,
    input: css`
      margin-bottom: ${theme.spacing(1)};
      margin-right: ${theme.spacing(1)};
    `,
    inputRow: css`
      display: flex;
    `,
    destroyInputRow: css`
      padding: ${theme.spacing(1)};
    `,
    fieldArray: css`
      margin-bottom: ${theme.spacing(4)};
    `,
  };
};
