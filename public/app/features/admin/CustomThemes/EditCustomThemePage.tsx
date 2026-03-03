import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom-v5-compat';

import { useGetThemeQuery, useUpdateThemeMutation } from '@grafana/api-clients/rtkq/theme/v0alpha1';
import { NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Field, Input, Stack, TextArea } from '@grafana/ui';

import { Page } from '../../../core/components/Page/Page';

interface FormData {
  themeJson: string;
  themeName: string;
}

export default function EditCustomThemePage() {
  const { name } = useParams<{ name: string }>();
  const { data: theme, isLoading: isLoadingTheme } = useGetThemeQuery({ name: name! });
  const [updateTheme, { isLoading }] = useUpdateThemeMutation();
  const navigate = useNavigate();

  const pageNav: NavModelItem = {
    icon: 'palette',
    id: 'custom-themes-edit',
    text: t('admin.edit-custom-theme-page.page-nav.text', 'Edit custom theme'),
    subTitle: t(
      'admin.edit-custom-theme-page.page-nav.subTitle.custom-theme-organization',
      'Edit a custom theme for your organization.'
    ),
  };

  const {
    handleSubmit,
    register,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormData>();

  useEffect(() => {
    if (theme) {
      reset({
        themeName: theme.metadata.name,
        themeJson: JSON.stringify(theme.spec, null, 2),
      });
    }
  }, [theme, reset]);

  const onSubmit = async ({ themeJson }: FormData) => {
    await updateTheme({
      name: name!,
      patch: { spec: JSON.parse(themeJson) },
    });
    navigate('/themes');
  };

  return (
    <Page navId="custom-themes" pageNav={pageNav}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack gap={2} direction="column">
          <Field noMargin label={t('admin.edit-custom-theme-page.field-theme-name', 'Theme name')}>
            <Input {...register('themeName')} disabled />
          </Field>
          <Field
            noMargin
            label={t('admin.edit-custom-theme-page.field-theme-json', 'Theme JSON')}
            invalid={!!errors.themeJson}
            error={
              errors.themeJson &&
              t('admin.edit-custom-theme-page.field-theme-json.validation-required', 'Theme JSON is required')
            }
          >
            <TextArea {...register('themeJson', { required: true })} rows={20} />
          </Field>
          <Stack justifyContent="flex-end">
            <Button variant="secondary" onClick={() => navigate('/themes')}>
              <Trans i18nKey="admin.edit-custom-theme-page.cancel">Cancel</Trans>
            </Button>
            <Button type="submit" disabled={isLoading || isLoadingTheme || !isDirty}>
              <Trans i18nKey="admin.edit-custom-theme-page.submit">Save custom theme</Trans>
            </Button>
          </Stack>
        </Stack>
      </form>
    </Page>
  );
}
