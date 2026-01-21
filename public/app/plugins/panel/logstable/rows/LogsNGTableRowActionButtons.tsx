import { css } from '@emotion/css';
import { memoize } from 'lodash';
import { useState } from 'react';

import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  ClipboardButton,
  CustomCellRendererProps,
  IconButton,
  TableCellInspector,
  TableCellInspectorMode,
  useTheme2,
} from '@grafana/ui';

import { BuildLinkToLogLine } from '../types';

interface Props extends CustomCellRendererProps {
  buildLinkToLog?: BuildLinkToLogLine;
  // timeFieldName: string;
  bodyFieldName: string;
}

/**
 * Logs row actions buttons
 * @param props
 * @constructor
 */
export function LogsNGTableRowActionButtons(props: Props) {
  const { rowIndex, frame, buildLinkToLog, bodyFieldName } = props;
  const theme = useTheme2();
  const [isInspecting, setIsInspecting] = useState(false);
  const styles = getStyles(theme);

  const handleViewClick = () => {
    setIsInspecting(true);
  };

  return (
    <>
      <div className={styles.container}>
        <div className={styles.buttonWrapper}>
          <IconButton
            className={styles.inspectButton}
            tooltip={t('explore.logs-table.action-buttons.view-log-line', 'View log line')}
            variant="secondary"
            aria-label={t('explore.logs-table.action-buttons.view-log-line', 'View log line')}
            tooltipPlacement="top"
            size="md"
            name="eye"
            onClick={handleViewClick}
            tabIndex={0}
          />
        </div>
        {buildLinkToLog && (
          <div className={styles.buttonWrapper}>
            <ClipboardButton
              className={styles.clipboardButton}
              icon="share-alt"
              variant="secondary"
              fill="text"
              size="md"
              tooltip={t('explore.logs-table.action-buttons.copy-link', 'Copy link to log line')}
              tooltipPlacement="top"
              tabIndex={0}
              aria-label={t('explore.logs-table.action-buttons.copy-link', 'Copy link to log line')}
              getText={() => {
                console.log('getText (@todo)');
                // buildLinkToLog(logsFrame, rowIndex, field)
                return '';
              }}
            />
          </div>
        )}
      </div>
      {isInspecting && (
        <TableCellInspector
          value={getLineValue(bodyFieldName, frame, rowIndex)}
          mode={TableCellInspectorMode.code}
          onDismiss={function (): void {
            setIsInspecting(false);
          }}
        />
      )}
    </>
  );
}

const getLineValue = memoize((bodyFieldName: string, frame: DataFrame, rowIndex: number) => {
  const bodyField = bodyFieldName
    ? frame.fields.find((field) => field.name === bodyFieldName)
    : frame.fields.find((field) => field.type === 'string');
  return bodyField?.values[rowIndex];
});

export const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    background: theme.colors.background.secondary,
    boxShadow: theme.shadows.z2,
    display: 'flex',
    flexDirection: 'row',
    height: '100%',
    left: 0,
    top: 0,
    position: 'absolute',
    zIndex: 1,
  }),
  buttonWrapper: css({
    height: '100%',
    '&:hover': {
      color: theme.colors.text.link,
    },
    padding: theme.spacing(0, 0.5),
    display: 'flex',
    alignItems: 'center',
  }),
  inspectButton: css({
    borderRadius: theme.shape.radius.default,
    display: 'inline-flex',
    margin: 0,
    overflow: 'hidden',
    verticalAlign: 'middle',
    cursor: 'pointer',
    height: '24px',
    width: '20px',
  }),
  clipboardButton: css({
    lineHeight: '1',
    padding: 0,
    width: '20px',
    cursor: 'pointer',
    height: '24px',
  }),
});
