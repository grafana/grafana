import { css, cx } from '@emotion/css';
import * as React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { Box, useStyles2 } from '@grafana/ui';
import { useAlertmanager } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

import { EditorColumnHeader } from '../../../contact-points/templates/EditorColumnHeader';
import { TemplateEditor } from '../../TemplateEditor';
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

  const { data, error } = usePreviewTemplate(templateContent, templateName, payload, setPayloadFormatError);
  const previewToRender = getPreviewResults(error, payloadFormatError, data);

  const templatePreviewId = 'template-preview';

  return (
    <div className={cx(className, styles.mainContainer)}>
      <div className={styles.container}>
        <EditorColumnHeader label="Template content" />
        <Box flex={1}>
          <div className={styles.viewerContainer({ height: 400 })}>
            <AutoSizer>
              {({ width, height }) => (
                <TemplateEditor
                  value={templateContent}
                  containerStyles={styles.editorContainer}
                  width={width}
                  height={height}
                  readOnly
                />
              )}
            </AutoSizer>
          </div>
        </Box>
      </div>

      {isGrafanaAlertManager && (
        <div className={styles.container}>
          <EditorColumnHeader id={templatePreviewId} label="Preview with the default payload" />
          <Box flex={1}>
            <div
              role="presentation"
              aria-describedby={templatePreviewId}
              className={styles.viewerContainer({ height: 'minHeight' })}
            >
              {previewToRender}
            </div>
          </Box>
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  mainContainer: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  }),
  container: css({
    label: 'template-preview-container',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.medium}`,
  }),
  viewerContainer: ({ height }: { height: number | string }) =>
    css({
      height,
      overflow: 'auto',
      backgroundColor: theme.colors.background.primary,
    }),
  editorContainer: css({
    width: 'fit-content',
    border: 'none',
  }),
});
