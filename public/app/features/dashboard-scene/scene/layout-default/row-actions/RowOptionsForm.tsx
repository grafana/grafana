import { useCallback, useState } from 'react';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { selectors } from '@grafana/e2e-selectors';
import { SceneObject } from '@grafana/scenes';
import { Button, Field, Modal, Input, Alert } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { RepeatRowSelect2 } from 'app/features/dashboard/components/RepeatRowSelect/RepeatRowSelect';

export type OnRowOptionsUpdate = (title: string, repeat?: string | null) => void;

export interface Props {
  title: string;
  repeat?: string;
  sceneContext: SceneObject;
  onUpdate: OnRowOptionsUpdate;
  onCancel: () => void;
  warning?: React.ReactNode;
}

export const RowOptionsForm = ({ repeat, title, sceneContext, warning, onUpdate, onCancel }: Props) => {
  const [newRepeat, setNewRepeat] = useState<string | undefined>(repeat);
  const onChangeRepeat = useCallback((name?: string) => setNewRepeat(name), [setNewRepeat]);

  const { handleSubmit, register } = useForm({
    defaultValues: {
      title,
    },
  });

  const submit = (formData: { title: string }) => {
    onUpdate(formData.title, newRepeat);
  };

  return (
    <form onSubmit={handleSubmit(submit)}>
      <Field label={t('dashboard.default-layout.row-options.form.title', 'Title')}>
        <Input {...register('title')} type="text" />
      </Field>
      <Field label={t('dashboard.default-layout.row-options.form.repeat-for', 'Repeat for')}>
        <RepeatRowSelect2 sceneContext={sceneContext} repeat={newRepeat} onChange={onChangeRepeat} />
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
          <Trans i18nKey="dashboard.default-layout.row-options.form.cancel">Cancel</Trans>
        </Button>
        <Button type="submit">
          <Trans i18nKey="dashboard.default-layout.row-options.form.update">Update</Trans>
        </Button>
      </Modal.ButtonRow>
    </form>
  );
};
