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
import { LogsFrame, DATAPLANE_ID_NAME } from 'app/features/logs/logsFrame';
import { getState } from 'app/store/store';

import { getExploreBaseUrl } from './utils/url';
interface Props extends CustomCellRendererProps {
  logId?: string;
  logsFrame?: LogsFrame;
  exploreId?: string;
  panelState?: ExploreLogsPanelState;
  displayedFields?: string[];
  absoluteRange?: AbsoluteTimeRange;
  logRows?: LogRowModel[];
  index?: number;
}

export function LogsTableActionButtons(props: Props) {
  const { exploreId, absoluteRange, logRows, rowIndex, panelState, displayedFields, logsFrame, frame } = props;
  const theme = useTheme2();
  const [isInspecting, setIsInspecting] = useState(false);
  // Get logId from the table frame (frame), not the original logsFrame, because
  // the table frame is sorted/transformed and rowIndex refers to the table frame
  const idFieldName = logsFrame?.idField?.name ?? DATAPLANE_ID_NAME;
  const idField = frame.fields.find((field) => field.name === idFieldName || field.name === DATAPLANE_ID_NAME);
  const logId = idField?.values[rowIndex];

  const getLineValue = () => {
    const logRowById = logRows?.find((row) => row.rowId === logId);
    return logRowById?.raw ?? '';
  };

  const styles = getStyles(theme);

  // Generate link to the log line
  const getText = useCallback(() => {
    if (!logId || !exploreId || !absoluteRange || !logRows) {
      return '';
    }

    try {
      // Get the log row from the logRows array
      const logRow = logRows.find((row) => row.rowId === logId);

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
          displayedFields: displayedFields ?? [],
        },
      };

      // Calculate the time range for the permalink
      urlState.range = getLogsPermalinkRange(logRow, logRows, absoluteRange);

      // Create the full URL with selectedLine as a URL parameter (with id and row)
      const serializedState = serializeStateToUrlParam(urlState);
      const baseUrl = getExploreBaseUrl();
      const url = urlUtil.renderUrl(`${baseUrl}/explore`, {
        left: serializedState,
        selectedLine: JSON.stringify({ id: logId, row: rowIndex }),
      });
      return url;
    } catch (error) {
      return '';
    }
  }, [absoluteRange, displayedFields, exploreId, logId, logRows, rowIndex, panelState]);

  const handleViewClick = () => {
    setIsInspecting(true);
  };

  return (
    <>
      <div className={styles.iconWrapper}>
        <IconButton
          className={styles.icon}
          tooltip={t('explore.logs-table.action-buttons.view-log-line', 'View log line')}
          variant="secondary"
          aria-label={t('explore.logs-table.action-buttons.view-log-line', 'View log line')}
          tooltipPlacement="top"
          size="md"
          name="eye"
          onClick={handleViewClick}
          tabIndex={0}
        />
        <ClipboardButton
          className={styles.icon}
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
      {isInspecting && (
        <Modal
          onDismiss={() => setIsInspecting(false)}
          isOpen={true}
          title={t('explore.logs-table.action-buttons.inspect-value', 'Inspect value')}
        >
          <pre>{getLineValue()}</pre>
          <Modal.ButtonRow>
            <ClipboardButton icon="copy" getText={() => getLineValue()}>
              {t('explore.logs-table.action-buttons.copy-to-clipboard', 'Copy to Clipboard')}
            </ClipboardButton>
          </Modal.ButtonRow>
        </Modal>
      )}
    </>
  );
}

export const getStyles = (theme: GrafanaTheme2) => ({
  iconWrapper: css({
    background: theme.colors.background.secondary,
    boxShadow: theme.shadows.z2,
    display: 'flex',
    flexDirection: 'row',
    height: '35px',
    left: 0,
    top: 0,
    padding: 0,
    position: 'absolute',
    zIndex: 1,
    alignItems: 'center',
    // Fix switching icon direction when cell is numeric (rtl)
    direction: 'ltr',
  }),
  icon: css({
    gap: 0,
    margin: 0,
    padding: 0,
    borderRadius: theme.shape.radius.default,
    width: '28px',
    height: '32px',
    display: 'inline-flex',
    justifyContent: 'center',

    '&:before': {
      content: '""',
      position: 'absolute',
      width: 24,
      height: 24,
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      margin: 'auto',
      borderRadius: theme.shape.radius.default,
      backgroundColor: theme.colors.background.primary,
      zIndex: -1,
      opacity: 0,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transitionDuration: '0.2s',
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        transitionProperty: 'opacity',
      },
    },
    '&:hover': {
      color: theme.colors.text.link,
      cursor: 'pointer',
      background: 'none',
      '&:before': {
        opacity: 1,
      },
    },
  }),
});
