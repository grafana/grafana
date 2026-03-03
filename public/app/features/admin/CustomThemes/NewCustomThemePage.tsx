import { css } from '@emotion/css';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { useCreateThemeMutation, API_GROUP, API_VERSION } from '@grafana/api-clients/rtkq/theme/v0alpha1';
import { createTheme as createGrafanaTheme, GrafanaTheme2, NavModelItem } from '@grafana/data';
import themeJsonSchema from '@grafana/data/themes/schema.generated.json';
import { Trans, t } from '@grafana/i18n';
import { Box, Button, CodeEditor, Field, Input, Stack, useStyles2 } from '@grafana/ui';

import { Page } from '../../../core/components/Page/Page';
import { ThemePreview } from '../../../core/components/Theme/ThemePreview';

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
  const styles = useStyles2(getStyles);
  const {
    handleSubmit,
    register,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>();
  const [themeName, themeJson] = watch(['themeName', 'themeJson']);
  const isBothFieldsPopulated = Boolean(themeName && themeJson);
  register('themeJson', { required: true });

  const previewTheme = useMemo(() => {
    try {
      return createGrafanaTheme(JSON.parse(themeJson));
    } catch {
      return null;
    }
  }, [themeJson]);

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
          <Stack direction={{ xs: 'column', md: 'row' }} gap={2} alignItems="stretch">
            <Field
              className={styles.codeEditor}
              noMargin
              label={t('admin.new-custom-theme-page.field-theme-json', 'Theme JSON')}
              invalid={!!errors.themeJson}
              error={
                errors.themeJson &&
                t('admin.new-custom-theme-page.field-theme-json.validation-required', 'Theme JSON is required')
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
            <Field noMargin label={t('admin.new-custom-theme-page.field-preview', 'Preview')}>
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
          </Stack>
          <Stack justifyContent="flex-end">
            <Button type="submit" disabled={isLoading || !isBothFieldsPopulated}>
              <Trans i18nKey="admin.new-custom-theme-page.submit">Add custom theme</Trans>
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
