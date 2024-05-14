import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Box, useStyles2 } from '@grafana/ui';
import { useAlertmanager } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

import { EditorColumnHeader } from '../../../contact-points/templates/EditorColumnHeader';
import { getPreviewResults } from '../../TemplatePreview';
import { usePreviewTemplate } from '../../usePreviewTemplate';

export function TemplateContentAndPreview({
  payload,
  templateContent,
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
  templateContent: string;
}) {
  const styles = useStyles2(getStyles);

  const { selectedAlertmanager } = useAlertmanager();
  const isGrafanaAlertManager = selectedAlertmanager === GRAFANA_RULES_SOURCE_NAME;

  const { data } = usePreviewTemplate(templateContent, templateName, payload, setPayloadFormatError);
  const previewToRender = getPreviewResults(undefined, payloadFormatError, data);

  return (
    <div className={cx(styles.container, className)}>
      <EditorColumnHeader label="Template content" />
      <Box flex={1}>
        <div className={styles.viewerContainer({ height: 400 })}>
          <div className={styles.templateContent}>{templateContent}</div>
        </div>
      </Box>

      {isGrafanaAlertManager && (
        <>
          <EditorColumnHeader label="Preview with the default payload" />
          <Box flex={1}>
            <div className={styles.viewerContainer({ height: 500 })}>{previewToRender}</div>
          </Box>
        </>
      )}
    </div>
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
  templateContent: css({
    padding: theme.spacing(2),
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
