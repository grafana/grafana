import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { Button, Input, Field, Label, TextArea, Stack, Alert, Box, TagsInput } from '@grafana/ui';

import { type DashboardScene } from '../scene/DashboardScene';

import { type OrgDashboardTemplate, updateOrgTemplate } from './orgTemplateApi';
import { type DashboardChangeInfo } from './shared';

interface SaveTemplateEditFormDTO {
  title: string;
  description: string;
  tags: string[];
}

export interface TemplateMetadata {
  name: string;
  namespace: string;
  resourceVersion: string;
  template: OrgDashboardTemplate;
}

export interface Props {
  dashboard: DashboardScene;
  changeInfo: DashboardChangeInfo;
  templateMetadata: TemplateMetadata;
}

export function SaveTemplateEditForm({ dashboard, changeInfo, templateMetadata }: Props) {
  const { template } = templateMetadata;

  const { register, handleSubmit, setValue, formState, watch } = useForm<SaveTemplateEditFormDTO>({
    mode: 'onBlur',
    defaultValues: {
      title: template.spec.title,
      description: template.spec.description,
      tags: template.spec.tags ?? [],
    },
  });

  const { errors, isValid } = formState;
  const formValues = watch();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const onSave = async () => {
    const data = formValues;
    setLoading(true);
    setError(undefined);

    try {
      const dashboardSpec = dashboard.serializer.getSaveModel(dashboard);

      const updatedTemplate: OrgDashboardTemplate = {
        ...template,
        spec: {
          ...template.spec,
          title: data.title,
          description: data.description,
          tags: data.tags,
          dashboard: dashboardSpec,
        },
      };

      await updateOrgTemplate(templateMetadata.namespace, templateMetadata.name, updatedTemplate);

      dashboard.closeModal();
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to update template'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSave)}>
      <Stack direction="column" gap={2}>
        <Field
          noMargin
          label={
            <Label htmlFor="title">
              <Trans i18nKey="dashboard-scene.save-template-edit-form.template-title">Template title</Trans>
            </Label>
          }
          invalid={!!errors.title}
          error={errors.title?.message}
        >
          <Input
            {...register('title', {
              required: t('dashboard-scene.save-template-edit-form.title-required', 'Required'),
            })}
            aria-label={t('dashboard-scene.save-template-edit-form.aria-label-template-title', 'Template title field')}
          />
        </Field>

        <Field
          noMargin
          label={
            <Label htmlFor="description">
              <Trans i18nKey="dashboard-scene.save-template-edit-form.template-description">Template description</Trans>
            </Label>
          }
        >
          <TextArea
            {...register('description')}
            aria-label={t(
              'dashboard-scene.save-template-edit-form.aria-label-template-description',
              'Template description field'
            )}
          />
        </Field>

        <Field
          noMargin
          label={
            <Label htmlFor="tags">
              <Trans i18nKey="dashboard-scene.save-template-edit-form.template-tags">Tags</Trans>
            </Label>
          }
        >
          <TagsInput tags={formValues.tags} onChange={(tags) => setValue('tags', tags)} />
        </Field>

        <Box paddingTop={2}>
          {error && (
            <Alert
              title={t('dashboard-scene.save-template-edit-form.error-title', 'Failed to update template')}
              severity="error"
            >
              {error.message && <p>{error.message}</p>}
            </Alert>
          )}
          <Stack alignItems="center">
            <Button variant="secondary" onClick={() => dashboard.closeModal()} fill="outline">
              <Trans i18nKey="dashboard-scene.save-template-edit-form.cancel">Cancel</Trans>
            </Button>
            <Button type="submit" disabled={!isValid || loading}>
              {loading
                ? t('dashboard-scene.save-template-edit-form.saving', 'Saving...')
                : t('dashboard-scene.save-template-edit-form.save', 'Update template')}
            </Button>
          </Stack>
        </Box>
      </Stack>
    </form>
  );
}
