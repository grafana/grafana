import { css, cx } from '@emotion/css';
import { compact, uniqueId } from 'lodash';
import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Box, Button, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { TemplatePreviewErrors, TemplatePreviewResponse, TemplatePreviewResult } from '../../api/templateApi';
import { stringifyErrorLike } from '../../utils/misc';
import { EditorColumnHeader } from '../contact-points/templates/EditorColumnHeader';

import type { TemplateFormValues } from './TemplateForm';
import { usePreviewTemplate } from './usePreviewTemplate';

export function TemplatePreview({
  payload,
  templateName,
  payloadFormatError,
  setPayloadFormatError,
  className,
}: {
  payload: string;
  templateName: string;
  payloadFormatError: string | null;
  setPayloadFormatError: (value: React.SetStateAction<string | null>) => void;
  className?: string;
}) {
  const styles = useStyles2(getStyles);

  const { watch } = useFormContext<TemplateFormValues>();

  const templateContent = watch('content');

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

  return (
    <ul className={styles.viewer.container}>
      {previews.map((preview) => (
        <li className={styles.viewer.box} key={preview.name}>
          {singleTemplate ? null : <header className={styles.viewer.header}>{preview.name}</header>}
          <pre className={styles.viewer.pre}>{preview.text ?? '<Empty>'}</pre>
        </li>
      ))}
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
      fontSize: theme.typography.bodySmall.fontSize,
      padding: theme.spacing(1, 2),
      borderBottom: `1px solid ${theme.colors.border.medium}`,
      backgroundColor: theme.colors.background.secondary,
    }),
    errorText: css({
      color: theme.colors.error.text,
    }),
    pre: css({
      backgroundColor: 'transparent',
      margin: 0,
      border: 'none',
      padding: theme.spacing(2),
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
