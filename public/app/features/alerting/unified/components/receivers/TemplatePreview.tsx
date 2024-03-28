import { css, cx } from '@emotion/css';
import { uniqueId } from 'lodash';
import React, { useCallback, useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2, Alert, Box } from '@grafana/ui';

import {
  AlertField,
  TemplatePreviewErrors,
  TemplatePreviewResponse,
  TemplatePreviewResult,
  usePreviewTemplateMutation,
} from '../../api/templateApi';
import { EditorColumnHeader } from '../contact-points/templates/EditorColumnHeader';

import type { TemplateFormValues } from './TemplateForm';

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

  const [trigger, { data, isError: isPreviewError, isLoading }] = usePreviewTemplateMutation();

  const previewToRender = getPreviewTorender(isPreviewError, payloadFormatError, data);

  const onPreview = useCallback(() => {
    try {
      const alertList: AlertField[] = JSON.parse(payload);
      JSON.stringify([...alertList]); // check if it's iterable, in order to be able to add more data
      trigger({ template: templateContent, alerts: alertList, name: templateName });
      setPayloadFormatError(null);
    } catch (e) {
      setPayloadFormatError(e instanceof Error ? e.message : 'Invalid JSON.');
    }
  }, [templateContent, templateName, payload, setPayloadFormatError, trigger]);

  useEffect(() => onPreview(), [onPreview]);

  return (
    <div className={cx(styles.container, className)}>
      <EditorColumnHeader
        label="Preview"
        actions={
          <Button
            disabled={isLoading}
            icon="sync"
            aria-label="Refresh preview"
            onClick={onPreview}
            size="sm"
            variant="secondary"
          >
            Refresh
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
  const styles = useStyles2(getStyles);

  return (
    <ul className={styles.viewer.container}>
      {errors.map((error) => (
        <li key={uniqueId('errors-list')} className={styles.viewer.box}>
          {error.name && <header className={cx(styles.viewer.header, styles.viewer.errorHeader)}>{error.name}</header>}
          <div>{error.kind}</div>
          <p>{error.message}</p>
        </li>
      ))}
    </ul>
  );
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
    }),
    box: css({
      display: 'flex',
      flexDirection: 'column',
      borderBottom: `1px solid ${theme.colors.border.medium}`,
    }),
    header: css({
      fontSize: theme.typography.bodySmall.fontSize,
      padding: theme.spacing(1, 2),
      borderBottom: `1px solid ${theme.colors.border.medium}`,
      backgroundColor: theme.colors.background.secondary,
    }),
    errorHeader: css({
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

export const PREVIEW_NOT_AVAILABLE = 'Preview request failed. Check if the payload data has the correct structure.';

export function getPreviewTorender(
  isPreviewError: boolean,
  payloadFormatError: string | null,
  data: TemplatePreviewResponse | undefined
): JSX.Element {
  // ERRORS IN JSON OR IN REQUEST (endpoint not available, for example)
  const previewErrorRequest = isPreviewError ? PREVIEW_NOT_AVAILABLE : undefined;
  const somethingWasWrong: boolean = isPreviewError || Boolean(payloadFormatError);
  const errorToRender = payloadFormatError || previewErrorRequest;

  //PREVIEW : RESULTS AND ERRORS
  const previewResponseResults = data?.results ?? [];
  const previewResponseErrors = data?.errors;

  return (
    <>
      {somethingWasWrong && (
        <Alert severity="error" title="Error">
          {errorToRender}
        </Alert>
      )}
      {previewResponseErrors && <PreviewErrorViewer errors={previewResponseErrors} data-testId="payloadJSON" />}
      {previewResponseResults && <PreviewResultViewer previews={previewResponseResults} data-testid="payloadJSON" />}
    </>
  );
}
