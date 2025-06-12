import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { SceneObject } from '@grafana/scenes';
import { Button, Field, Modal, Input, Alert, TextLink } from '@grafana/ui';
import { RepeatRowSelect2 } from 'app/features/dashboard/components/RepeatRowSelect/RepeatRowSelect';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';

export type OnRowOptionsUpdate = (title: string, repeat?: string | null) => void;

export interface Props {
  title: string;
  repeat?: string;
  sceneContext: SceneObject;
  onUpdate: OnRowOptionsUpdate;
  onCancel: () => void;
  isUsingDashboardDS: boolean;
}

export const RowOptionsForm = ({ repeat, title, sceneContext, isUsingDashboardDS, onUpdate, onCancel }: Props) => {
  const [newRepeat, setNewRepeat] = useState<string | undefined>(repeat);
  const onChangeRepeat = useCallback((name?: string) => setNewRepeat(name), [setNewRepeat]);

  const { handleSubmit, register } = useForm({
    defaultValues: { title },
  });

  const submit = (formData: { title: string }) => {
    onUpdate(formData.title, newRepeat);
  };

  return (
    <form onSubmit={handleSubmit(submit)}>
      <Field label={t('dashboard.default-layout.row-options.form.title', 'Title')}>
        <Input {...register('title')} type="text" />
      </Field>
      <Field label={t('dashboard.default-layout.row-options.form.repeat-for.label', 'Repeat for')}>
        <RepeatRowSelect2 sceneContext={sceneContext} repeat={newRepeat} onChange={onChangeRepeat} />
      </Field>
      {isUsingDashboardDS && (
        <Alert
          data-testid={selectors.pages.Dashboard.Rows.Repeated.ConfigSection.warningMessage}
          severity="warning"
          title=""
          topSpacing={3}
          bottomSpacing={0}
        >
          <div>
            <p>
              <Trans i18nKey="dashboard.default-layout.row-options.form.repeat-for.warning.text">
                Panels in this row use the {{ SHARED_DASHBOARD_QUERY }} data source. These panels will reference the
                panel in the original row, not the ones in the repeated rows.
              </Trans>
            </p>
            <TextLink
              external
              href={
                'https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/create-dashboard/#configure-repeating-rows'
              }
            >
              <Trans i18nKey="dashboard.default-layout.row-options.form.repeat-for.learn-more">Learn more</Trans>
            </TextLink>
          </div>
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
