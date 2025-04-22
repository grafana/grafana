import { css, cx } from '@emotion/css';
import { compact, uniqueId } from 'lodash';
import * as React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Box, Button, CodeEditor, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { TemplatePreviewErrors, TemplatePreviewResponse, TemplatePreviewResult } from '../../api/templateApi';
import { stringifyErrorLike } from '../../utils/misc';
import { EditorColumnHeader } from '../contact-points/templates/EditorColumnHeader';

import { usePreviewTemplate } from './usePreviewTemplate';

export function TemplatePreview({
  payload,
  templateName,
  templateContent,
  payloadFormatError,
  setPayloadFormatError,
  className,
}: {
  payload: string;
  templateName: string;
  templateContent: string;
  payloadFormatError: string | null;
  setPayloadFormatError: (value: React.SetStateAction<string | null>) => void;
  className?: string;
}) {
  const styles = useStyles2(getStyles);

  const {
    data,
    isLoading,
    onPreview,
    error: previewError,
  } = usePreviewTemplate(templateContent, templateName, payload, setPayloadFormatError);
  const previewToRender = getPreviewResults(previewError, payloadFormatError, data);

  return (
    <div className={cx(styles.container, className)}>
      <EditorColumnHeader
        label={t('alerting.template-preview.label-preview', 'Preview')}
        actions={
          <Button
            disabled={isLoading}
            icon="sync"
            aria-label={t('alerting.template-preview.aria-label-refresh-preview', 'Refresh preview')}
            onClick={onPreview}
            size="sm"
            variant="secondary"
          >
            <Trans i18nKey="alerting.template-preview.refresh">Refresh</Trans>
          </Button>
        }
      />
      <Box flex={1}>
        <AutoSizer disableWidth>
          {({ height }) => <div className={styles.viewerContainer({ height })}>{previewToRender}</div>}
        </AutoSizer>
      </Box>
    </div>
  );
}

function PreviewResultViewer({ previews }: { previews: TemplatePreviewResult[] }) {
  const styles = useStyles2(getStyles);
  // If there is only one template, we don't need to show the name
  const singleTemplate = previews.length === 1;

  const isValidJson = (text: string) => {
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <ul className={styles.viewer.container} data-testid="template-preview">
      {previews.map((preview) => {
        const language = isValidJson(preview.text) ? 'json' : 'plaintext';
        return (
          <li className={styles.viewer.box} key={preview.name}>
            {singleTemplate ? null : (
              <header className={styles.viewer.header}>
                {preview.name}
                <div className={styles.viewer.language}>{language}</div>
              </header>
            )}
            <CodeEditor
              containerStyles={styles.editorContainer}
              language={language}
              showLineNumbers={false}
              showMiniMap={false}
              value={preview.text}
              readOnly={true}
              monacoOptions={{
                scrollBeyondLastLine: false,
              }}
            />
          </li>
        );
      })}
    </ul>
  );
}

function PreviewErrorViewer({ errors }: { errors: TemplatePreviewErrors[] }) {
  return errors.map((error) => (
    <Alert key={uniqueId('errors-list')} title={compact([error.name, error.kind]).join(' – ')}>
      {error.message}
    </Alert>
  ));
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    label: 'template-preview-container',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.medium}`,
  }),
  editorContainer: css({
    width: '100%',
    height: '100%',
    border: 'none',
  }),
  viewerContainer: ({ height }: { height: number }) =>
    css({
      height,
      overflow: 'auto',
      backgroundColor: theme.colors.background.primary,
    }),
  viewer: {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      height: 'inherit',
    }),
    box: css({
      display: 'flex',
      flexDirection: 'column',
      borderBottom: `1px solid ${theme.colors.border.medium}`,
      height: 'inherit',
    }),
    header: css({
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: theme.typography.bodySmall.fontSize,
      padding: theme.spacing(1, 2),
      borderBottom: `1px solid ${theme.colors.border.medium}`,
      backgroundColor: theme.colors.background.secondary,
    }),
    language: css({
      marginLeft: 'auto',
      fontStyle: 'italic',
    }),
    errorText: css({
      color: theme.colors.error.text,
    }),
  },
});

export function getPreviewResults(
  previewError: unknown | undefined,
  payloadFormatError: string | null,
  data: TemplatePreviewResponse | undefined
): JSX.Element {
  // ERRORS IN JSON OR IN REQUEST (endpoint not available, for example)
  const previewErrorRequest = previewError ? stringifyErrorLike(previewError) : undefined;
  const errorToRender = payloadFormatError || previewErrorRequest;

  //PREVIEW : RESULTS AND ERRORS
  const previewResponseResults = data?.results ?? [];
  const previewResponseErrors = data?.errors;

  return (
    <>
      {errorToRender && (
        <Alert severity="error" title={t('alerting.get-preview-results.title-error', 'Error')}>
          {errorToRender}
        </Alert>
      )}
      {previewResponseErrors && <PreviewErrorViewer errors={previewResponseErrors} />}
      {previewResponseResults && <PreviewResultViewer previews={previewResponseResults} />}
    </>
  );
}
