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
import { LogsFrame } from 'app/features/logs/logsFrame';

import { BuildLinkToLogLine } from './types';

interface Props extends CustomCellRendererProps {
  logsFrame: LogsFrame;
  buildLinkToLog?: BuildLinkToLogLine;
}

/**
 * Logs row actions buttons
 * @param props
 * @constructor
 */
export function LogsNGTableRowActionButtons(props: Props) {
  const { rowIndex, logsFrame, field, frame, buildLinkToLog } = props;
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
              getText={() => buildLinkToLog(logsFrame, rowIndex, field)}
            />
          </div>
        )}
      </div>
      {isInspecting && (
        <TableCellInspector
          value={getLineValue(logsFrame, frame, rowIndex)}
          mode={TableCellInspectorMode.code}
          onDismiss={function (): void {
            setIsInspecting(false);
          }}
        />
      )}
    </>
  );
}

const getLineValue = memoize((logsFrame: LogsFrame, frame: DataFrame, rowIndex: number) => {
  const bodyFieldName = logsFrame?.bodyField?.name;
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
    padding: `0 ${theme.spacing(0.5)}`,
    position: 'absolute',
    zIndex: 1,
  }),
  buttonWrapper: css({
    height: '100%',
    '& button svg': {
      marginRight: 'auto',
    },
    '&:hover': {
      color: theme.colors.text.link,
    },
    padding: theme.spacing(0, 1),
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
  }),
  clipboardButton: css({
    height: 30,
    lineHeight: '1',
    padding: 0,
    width: '20px',
    cursor: 'pointer',
  }),
});
