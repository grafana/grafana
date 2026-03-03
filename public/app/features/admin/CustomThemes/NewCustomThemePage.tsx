import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { useCreateThemeMutation, API_GROUP, API_VERSION } from '@grafana/api-clients/rtkq/theme/v0alpha1';
import { NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, Field, Input, Stack, TextArea } from '@grafana/ui';

import { Page } from '../../../core/components/Page/Page';

interface FormData {
  themeJson: string;
  themeName: string;
}

export default function NewCustomThemePage() {
  const pageNav: NavModelItem = {
    icon: 'palette',
    id: 'custom-themes-new',
    text: t('admin.new-custom-theme-page.page-nav.text.add-custom-theme', 'Add custom theme'),
    subTitle: t(
      'admin.new-custom-theme-page.page-nav.subTitle.custom-theme-organization',
      'Add a custom theme for your organization.'
    ),
  };

  const [createTheme, { isLoading }] = useCreateThemeMutation();
  const navigate = useNavigate();
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<FormData>();

  const onSubmit = async ({ themeJson, themeName }: FormData) => {
    await createTheme({
      theme: {
        apiVersion: `${API_GROUP}/${API_VERSION}`,
        kind: 'Theme',
        metadata: {
          name: themeName,
        },
        spec: JSON.parse(themeJson),
      },
    });
    navigate('/themes');
  };

  return (
    <Page navId="custom-themes" pageNav={pageNav}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack direction="column" gap={2}>
          <Field
            noMargin
            label={t('admin.new-custom-theme-page.field-theme-name', 'Theme name')}
            invalid={!!errors.themeName}
            error={
              errors.themeName &&
              t('admin.new-custom-theme-page.field-theme-name.validation-required', 'Theme name is required')
            }
          >
            <Input {...register('themeName', { required: true })} />
          </Field>
          <Field
            noMargin
            label={t('admin.new-custom-theme-page.field-theme-json', 'Theme JSON')}
            invalid={!!errors.themeJson}
            error={
              errors.themeJson &&
              t('admin.new-custom-theme-page.field-theme-json.validation-required', 'Theme JSON is required')
            }
          >
            <TextArea {...register('themeJson', { required: true })} rows={20} placeholder="{}" />
          </Field>
          <Stack justifyContent="flex-end">
            <Button type="submit" disabled={isLoading}>
              <Trans i18nKey="admin.new-custom-theme-page.submit">Add custom theme</Trans>
            </Button>
          </Stack>
        </Stack>
      </form>
    </Page>
  );
}
