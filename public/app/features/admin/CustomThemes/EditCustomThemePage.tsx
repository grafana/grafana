import { css } from '@emotion/css';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom-v5-compat';

import { useGetThemeQuery, useUpdateThemeMutation } from '@grafana/api-clients/rtkq/theme/v0alpha1';
import { createTheme, GrafanaTheme2, NavModelItem } from '@grafana/data';
import themeJsonSchema from '@grafana/data/themes/schema.generated.json';
import { Trans, t } from '@grafana/i18n';
import { Box, Button, CodeEditor, Field, Input, Stack, useStyles2 } from '@grafana/ui';

import { Page } from '../../../core/components/Page/Page';
import { ThemePreview } from '../../../core/components/Theme/ThemePreview';

interface FormData {
  themeJson: string;
  themeID: string;
}

export default function EditCustomThemePage() {
  const { name } = useParams<{ name: string }>();
  const { data: theme, isLoading: isLoadingTheme } = useGetThemeQuery({ name: name! });
  const [updateTheme, { isLoading }] = useUpdateThemeMutation();
  const navigate = useNavigate();
  const styles = useStyles2(getStyles);

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
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormData>();
  const themeJson = watch('themeJson');
  register('themeJson', { required: true });

  useEffect(() => {
    if (theme) {
      reset({
        themeID: theme.metadata.name,
        themeJson: JSON.stringify(theme.spec, null, 2),
      });
    }
  }, [theme, reset]);

  const previewTheme = useMemo(() => {
    try {
      return createTheme(JSON.parse(themeJson));
    } catch {
      return null;
    }
  }, [themeJson]);

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
          <Stack direction={{ xs: 'column', md: 'row' }} gap={2} alignItems="stretch">
            <Field
              className={styles.codeEditor}
              noMargin
              label={t('admin.edit-custom-theme-page.field-theme-json', 'Theme JSON')}
              invalid={!!errors.themeJson}
              error={
                errors.themeJson &&
                t('admin.edit-custom-theme-page.field-theme-json.validation-required', 'Theme JSON is required')
              }
            >
              <CodeEditor
                value={themeJson ?? ''}
                language="json"
                height={400}
                width="100%"
                showLineNumbers={true}
                onChange={(value) => setValue('themeJson', value, { shouldValidate: true, shouldDirty: true })}
                onBeforeEditorMount={(monaco) => {
                  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                    validate: true,
                    schemas: [{ uri: 'theme-schema', fileMatch: ['*'], schema: themeJsonSchema }],
                  });
                }}
              />
            </Field>
            <Stack direction="column" gap={2}>
              <Field noMargin label={t('admin.edit-custom-theme-page.field-preview', 'Preview')}>
                <Box
                  boxShadow="z1"
                  display="flex"
                  overflow="hidden"
                  borderRadius="default"
                  height={30}
                  minWidth={40}
                  width="100%"
                  borderStyle="solid"
                  borderColor="medium"
                >
                  {previewTheme && <ThemePreview theme={previewTheme} />}
                </Box>
              </Field>
              <Field noMargin label={t('admin.edit-custom-theme-page.field-theme-id', 'Theme ID')}>
                <Input {...register('themeID')} disabled />
              </Field>
            </Stack>
          </Stack>
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

const getStyles = (theme: GrafanaTheme2) => ({
  codeEditor: css({
    flex: 1,
    overflow: 'hidden',
  }),
});
