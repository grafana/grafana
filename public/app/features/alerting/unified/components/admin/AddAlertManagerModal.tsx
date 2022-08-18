import { css, cx } from '@emotion/css';
import React, { FC, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Field, FieldArray, Form, Icon, Input, Modal, useStyles2 } from '@grafana/ui';
import { AlertmanagerUrl } from 'app/plugins/datasource/alertmanager/types';

interface Props {
  onClose: () => void;
  alertmanagers: AlertmanagerUrl[];
  onChangeAlertmanagerConfig: (alertmanagers: string[]) => void;
}

export const AddAlertManagerModal: FC<Props> = ({ alertmanagers, onChangeAlertmanagerConfig, onClose }) => {
  const styles = useStyles2(getStyles);
  const defaultValues: Record<string, AlertmanagerUrl[]> = useMemo(
    () => ({
      alertmanagers: alertmanagers,
    }),
    [alertmanagers]
  );

  const modalTitle = (
    <div className={styles.modalTitle}>
      <Icon name="bell" className={styles.modalIcon} />
      <h3>Add Alertmanager</h3>
    </div>
  );

  const onSubmit = (values: Record<string, AlertmanagerUrl[]>) => {
    onChangeAlertmanagerConfig(values.alertmanagers.map((am) => cleanAlertmanagerUrl(am.url)));
    onClose();
  };

  return (
    <Modal title={modalTitle} isOpen={true} onDismiss={onClose} className={styles.modal}>
      <div className={styles.description}>
        We use a service discovery method to find existing Alertmanagers for a given URL.
      </div>
      <Form onSubmit={onSubmit} defaultValues={defaultValues}>
        {({ register, control, errors }) => (
          <div>
            <FieldArray control={control} name="alertmanagers">
              {({ fields, append, remove }) => (
                <div className={styles.fieldArray}>
                  <div className={styles.bold}>Source url</div>
                  <div className={styles.muted}>
                    Authentication can be done via URL (e.g. user:password@myalertmanager.com) and only the Alertmanager
                    v2 API is supported. The suffix is added internally, there is no need to specify it.
                  </div>
                  {fields.map((field, index) => {
                    return (
                      <Field
                        invalid={!!errors?.alertmanagers?.[index]}
                        error="Field is required"
                        key={`${field.id}-${index}`}
                      >
                        <Input
                          className={styles.input}
                          defaultValue={field.url}
                          {...register(`alertmanagers.${index}.url`, { required: true })}
                          placeholder="http://localhost:9093"
                          addonAfter={
                            <Button
                              aria-label="Remove alertmanager"
                              type="button"
                              onClick={() => remove(index)}
                              variant="destructive"
                              className={styles.destroyInputRow}
                            >
                              <Icon name="trash-alt" />
                            </Button>
                          }
                        />
                      </Field>
                    );
                  })}
                  <Button type="button" variant="secondary" onClick={() => append({ url: '' })}>
                    Add URL
                  </Button>
                </div>
              )}
            </FieldArray>
            <div>
              <Button type="submit" onSubmit={() => onSubmit}>
                Add Alertmanagers
              </Button>
            </div>
          </div>
        )}
      </Form>
    </Modal>
  );
};

function cleanAlertmanagerUrl(url: string): string {
  return url.replace(/\/$/, '').replace(/\/api\/v[1|2]\/alerts/i, '');
}

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
