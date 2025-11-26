import { css } from '@emotion/css';
import { useCallback, useState } from 'react';

import {
  AbsoluteTimeRange,
  ExploreLogsPanelState,
  GrafanaTheme2,
  LogRowModel,
  serializeStateToUrlParam,
  urlUtil,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { ClipboardButton, CustomCellRendererProps, IconButton, Modal, useTheme2 } from '@grafana/ui';
import { getLogsPermalinkRange } from 'app/core/utils/shortLinks';
import { getUrlStateFromPaneState } from 'app/features/explore/hooks/useStateSync';
import { LogsFrame } from 'app/features/logs/logsFrame';
import { getState } from 'app/store/store';
interface Props extends CustomCellRendererProps {
  logId?: string;
  logsFrame?: LogsFrame;
  exploreId?: string;
  panelState?: ExploreLogsPanelState;
  displayedFields?: string[];
  visualisationType?: 'table' | 'logs';
  absoluteRange?: AbsoluteTimeRange;
  logRows?: LogRowModel[];
}

export function LogsTableActionButtons(props: Props) {
  const {
    logId,
    exploreId,
    absoluteRange,
    logRows,
    rowIndex,
    visualisationType,
    panelState,
    displayedFields,
    logsFrame,
    frame,
  } = props;

  const theme = useTheme2();
  const [isInspecting, setIsInspecting] = useState(false);
  const getLineValue = () => {
    const bodyFieldName = logsFrame?.bodyField?.name;
    const bodyField = bodyFieldName
      ? frame.fields.find((field) => field.name === bodyFieldName)
      : frame.fields.find((field) => field.type === 'string');

    return bodyField?.values[rowIndex];
  };

  const lineValue = getLineValue();

  const styles = getStyles(theme);

  // Generate link to the log line
  const getText = useCallback(() => {
    if (!logId || !exploreId || !absoluteRange || !logRows) {
      return '';
    }

    try {
      // Get the log row from the logRows array
      const logRow = logRows[rowIndex];
      if (!logRow) {
        return '';
      }

      // Get the current explore state
      const currentPaneState = getState().explore.panes[exploreId];
      if (!currentPaneState) {
        return '';
      }

      // Create URL state with log permalink information
      const urlState = getUrlStateFromPaneState(currentPaneState);

      // Preserve all panel state (columns, labelFieldName, etc.)
      urlState.panelsState = {
        ...currentPaneState.panelsState,
        logs: {
          ...panelState,
          visualisationType: visualisationType ?? 'table',
          displayedFields: displayedFields ?? [],
        },
      };

      // Calculate the time range for the permalink
      urlState.range = getLogsPermalinkRange(logRow, logRows, absoluteRange);

      // Create the full URL with selectedLine as a URL parameter (with id and row)
      const serializedState = serializeStateToUrlParam(urlState);
      const baseUrl = /.*(?=\/explore)/.exec(`${window.location.href}`)![0];
      const url = urlUtil.renderUrl(`${baseUrl}/explore`, {
        left: serializedState,
        selectedLine: JSON.stringify({ id: logId, row: rowIndex }),
      });

      return url;
    } catch (error) {
      return '';
    }
  }, [absoluteRange, displayedFields, exploreId, logId, logRows, rowIndex, visualisationType, panelState]);

  const handleViewClick = () => {
    setIsInspecting(true);
  };

  return (
    <>
      <div className={styles.iconWrapper}>
        <div className={styles.inspect}>
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
        <div className={styles.inspect}>
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
            getText={getText}
          />
        </div>
      </div>
      {isInspecting && (
        <Modal
          onDismiss={() => setIsInspecting(false)}
          isOpen={true}
          title={t('explore.logs-table.action-buttons.inspect-value', 'Inspect value')}
        >
          <pre>{lineValue}</pre>
          <Modal.ButtonRow>
            <ClipboardButton icon="copy" getText={() => lineValue}>
              {t('explore.logs-table.action-buttons.copy-to-clipboard', 'Copy to Clipboard')}
            </ClipboardButton>
          </Modal.ButtonRow>
        </Modal>
      )}
    </>
  );
}

export const getStyles = (theme: GrafanaTheme2) => ({
  clipboardButton: css({
    height: '100%',
    lineHeight: '1',
    padding: 0,
    width: '20px',
  }),
  iconWrapper: css({
    background: theme.colors.background.secondary,
    boxShadow: theme.shadows.z2,
    display: 'flex',
    flexDirection: 'row',
    height: '35px',
    left: 0,
    top: 0,
    padding: `0 ${theme.spacing(0.5)}`,
    position: 'absolute',
    zIndex: 1,
  }),
  inspect: css({
    '& button svg': {
      marginRight: 'auto',
    },
    '&:hover': {
      color: theme.colors.text.link,
      cursor: 'pointer',
    },
    padding: '5px 3px',
  }),
  inspectButton: css({
    borderRadius: theme.shape.radius.default,
    display: 'inline-flex',
    margin: 0,
    overflow: 'hidden',
    verticalAlign: 'middle',
  }),
});
