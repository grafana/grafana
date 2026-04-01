import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Button, Input, Field, Label, TextArea, Stack, Alert, Box, TagsInput, Text } from '@grafana/ui';

import { type DashboardScene } from '../scene/DashboardScene';

import { createOrgTemplate } from './orgTemplateApi';
import { type DashboardChangeInfo } from './shared';

interface SaveAsTemplateFormDTO {
  title: string;
  description: string;
  tags: string[];
}

export interface Props {
  dashboard: DashboardScene;
  changeInfo: DashboardChangeInfo;
}

export function SaveAsTemplateForm({ dashboard, changeInfo }: Props) {
  const { changedSaveModel } = changeInfo;

  const { register, handleSubmit, setValue, formState, watch } = useForm<SaveAsTemplateFormDTO>({
    mode: 'onBlur',
    defaultValues: {
      title: changedSaveModel.title ?? '',
      description: changedSaveModel.description ?? '',
      tags: [],
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
      const namespace = 'default';
      const dashboardSpec = dashboard.serializer.getSaveModel(dashboard);

      await createOrgTemplate(namespace, {
        title: data.title,
        description: data.description,
        tags: data.tags,
        sourceDashboardUID: dashboard.state.uid,
        dashboard: dashboardSpec,
      });

      locationService.partial({ templateSaved: data.title });
      dashboard.closeModal();
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to save template'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSave)}>
      <Stack direction="column" gap={2}>
        <Text color="secondary">
          <Trans i18nKey="dashboard-scene.save-as-template-form.description">
            Custom templates are saved as a separate resource, similar to dashboards with custom metadata. They can be
            used through the template gallery, and edited through your folders.
          </Trans>
        </Text>

        <Field
          noMargin
          label={
            <Label htmlFor="title">
              <Trans i18nKey="dashboard-scene.save-as-template-form.template-title">Template title</Trans>
            </Label>
          }
          invalid={!!errors.title}
          error={errors.title?.message}
        >
          <Input
            {...register('title', {
              required: t('dashboard-scene.save-as-template-form.title-required', 'Required'),
            })}
            aria-label={t('dashboard-scene.save-as-template-form.aria-label-template-title', 'Template title field')}
          />
        </Field>

        <Field
          noMargin
          label={
            <Label htmlFor="description">
              <Trans i18nKey="dashboard-scene.save-as-template-form.template-description">Template description</Trans>
            </Label>
          }
        >
          <TextArea
            {...register('description')}
            aria-label={t(
              'dashboard-scene.save-as-template-form.aria-label-template-description',
              'Template description field'
            )}
          />
        </Field>

        <Field
          noMargin
          label={
            <Label htmlFor="tags">
              <Trans i18nKey="dashboard-scene.save-as-template-form.template-tags">Tags</Trans>
            </Label>
          }
        >
          <TagsInput tags={formValues.tags} onChange={(tags) => setValue('tags', tags)} />
        </Field>

        <Box paddingTop={2}>
          {error && (
            <Alert
              title={t('dashboard-scene.save-as-template-form.error-title', 'Failed to save template')}
              severity="error"
            >
              {error.message && <p>{error.message}</p>}
            </Alert>
          )}
          <Stack alignItems="center">
            <Button variant="secondary" onClick={() => dashboard.closeModal()} fill="outline">
              <Trans i18nKey="dashboard-scene.save-as-template-form.cancel">Cancel</Trans>
            </Button>
            <Button type="submit" disabled={!isValid || loading}>
              {loading
                ? t('dashboard-scene.save-as-template-form.saving', 'Saving...')
                : t('dashboard-scene.save-as-template-form.save', 'Save as template')}
            </Button>
          </Stack>
        </Box>
      </Stack>
    </form>
  );
}
