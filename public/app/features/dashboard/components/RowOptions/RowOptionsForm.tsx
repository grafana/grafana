import { useCallback, useState } from 'react';
import * as React from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Button, Field, Modal, Input, Alert } from '@grafana/ui';
import { Form } from 'app/core/components/Form/Form';

import { RepeatRowSelect } from '../RepeatRowSelect/RepeatRowSelect';

export type OnRowOptionsUpdate = (title: string, repeat?: string | null) => void;

export interface Props {
  title: string;
  repeat?: string;
  onUpdate: OnRowOptionsUpdate;
  onCancel: () => void;
  warning?: React.ReactNode;
}

export const RowOptionsForm = ({ repeat, title, warning, onUpdate, onCancel }: Props) => {
  const [newRepeat, setNewRepeat] = useState<string | undefined>(repeat);

  const onChangeRepeat = useCallback((name?: string) => setNewRepeat(name), [setNewRepeat]);

  return (
    <Form
      defaultValues={{ title }}
      onSubmit={(formData: { title: string }) => {
        onUpdate(formData.title, newRepeat);
      }}
    >
      {({ register }) => (
        <>
          <Field label={t('dashboard.row-options-form.label-title', 'Title')}>
            <Input {...register('title')} type="text" />
          </Field>
          <Field label={t('dashboard.row-options-form.label-repeat-for', 'Repeat for')}>
            <RepeatRowSelect repeat={newRepeat} onChange={onChangeRepeat} />
          </Field>
          {warning && (
            <Alert
              data-testid={selectors.pages.Dashboard.Rows.Repeated.ConfigSection.warningMessage}
              severity="warning"
              title=""
              topSpacing={3}
              bottomSpacing={0}
            >
              {warning}
            </Alert>
          )}
          <Modal.ButtonRow>
            <Button type="button" variant="secondary" onClick={onCancel} fill="outline">
              <Trans i18nKey="dashboard.row-options-form.cancel">Cancel</Trans>
            </Button>
            <Button type="submit">
              <Trans i18nKey="dashboard.row-options-form.update">Update</Trans>
            </Button>
          </Modal.ButtonRow>
        </>
      )}
    </Form>
  );
};
