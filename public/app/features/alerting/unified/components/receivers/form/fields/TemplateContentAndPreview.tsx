import { css, cx } from '@emotion/css';
import * as React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Box, useStyles2 } from '@grafana/ui';
import { useAlertmanager } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';

import { EditorColumnHeader } from '../../../contact-points/templates/EditorColumnHeader';
import { TemplateEditor } from '../../TemplateEditor';
import { TemplatePreview } from '../../TemplatePreview';

import { getUseTemplateText } from './utils';

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

  return (
    <div className={cx(className, styles.mainContainer)}>
      <div className={styles.container}>
        <EditorColumnHeader
          label={t('alerting.template-content-and-preview.label-template-content', 'Template content')}
        />
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
        <TemplatePreview
          payload={payload}
          // This should be an empty template name so that the test API treats it as a new unnamed template.
          templateName={''}
          templateContent={getUseTemplateText(templateName)}
          setPayloadFormatError={setPayloadFormatError}
          payloadFormatError={payloadFormatError}
          className={cx(styles.templatePreview, styles.minEditorSize)}
        />
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
  templatePreview: css({
    flex: 1,
    display: 'flex',
  }),
  minEditorSize: css({
    minHeight: 300,
    minWidth: 300,
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
