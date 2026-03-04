import { css } from '@emotion/css';
import { useEffect, useId, useMemo } from 'react';
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
  themeID: string;
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
    formState: { errors, dirtyFields },
  } = useForm<FormData>();
  const [themeID, themeJson] = watch(['themeID', 'themeJson']);
  const themeIDInput = useId();

  const isBothFieldsPopulated = Boolean(themeID && themeJson);
  register('themeJson', { required: true });

  const previewTheme = useMemo(() => {
    try {
      return createGrafanaTheme(JSON.parse(themeJson));
    } catch {
      return null;
    }
  }, [themeJson]);

  // Auto-generate themeID from theme name when the user hasn't manually edited the field
  useEffect(() => {
    if (dirtyFields.themeID) {
      return;
    }
    try {
      const parsed = JSON.parse(themeJson);
      if (typeof parsed.name === 'string' && parsed.name) {
        const generated = parsed.name
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9\-_]/g, '');
        setValue('themeID', generated, { shouldValidate: true });
      }
    } catch {
      // invalid JSON, skip
    }
  }, [themeJson, setValue, dirtyFields.themeID]);

  const onSubmit = async ({ themeJson, themeID }: FormData) => {
    await createTheme({
      theme: {
        apiVersion: `${API_GROUP}/${API_VERSION}`,
        kind: 'Theme',
        metadata: {
          name: themeID,
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
          <Stack direction={{ xs: 'column', md: 'row' }} gap={2} alignItems="stretch">
            <Field
              required
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
            <Stack direction="column" gap={2}>
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
              <Field
                required
                noMargin
                label={t('admin.new-custom-theme-page.field-theme-id', 'Theme ID')}
                invalid={!!errors.themeID}
                error={
                  errors.themeID?.type === 'pattern'
                    ? t(
                        'admin.new-custom-theme-page.field-theme-id.validation-pattern',
                        'Theme ID can only contain lowercase letters, numbers, hyphens and underscores'
                      )
                    : errors.themeID &&
                      t('admin.new-custom-theme-page.field-theme-id.validation-required', 'Theme ID is required')
                }
              >
                <Input {...register('themeID', { required: true, pattern: /^[a-zA-Z0-9:\-_.]*$/ })} id={themeIDInput} />
              </Field>
            </Stack>
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
