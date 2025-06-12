import { css } from '@emotion/css';
import { Resizable } from 're-resizable';
import { useCallback, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useTranslate } from '@grafana/i18n';
import { getDragStyles, IconButton, useStyles2, useTheme2 } from '@grafana/ui';
import { GetFieldLinksFn } from 'app/plugins/panel/logs/types';

import { LogDetails } from '../LogDetails';
import { getLogRowStyles } from '../getLogRowStyles';

import { useLogListContext } from './LogListContext';
import { LogListModel } from './processing';
import { LOG_LIST_MIN_WIDTH } from './virtualization';

interface Props {
  containerElement: HTMLDivElement;
  getFieldLinks?: GetFieldLinksFn;
  logs: LogListModel[];
  onResize(): void;
}

export const LogLineDetails = ({ containerElement, getFieldLinks, logs, onResize }: Props) => {
  const {
    app,
    closeDetails,
    detailsWidth,
    displayedFields,
    isLabelFilterActive,
    onClickFilterLabel,
    onClickFilterOutLabel,
    onClickShowField,
    onClickHideField,
    onPinLine,
    pinLineButtonTooltipTitle,
    setDetailsWidth,
    showDetails,
    wrapLogMessage,
  } = useLogListContext();
  const getRows = useCallback(() => logs, [logs]);
  const logRowsStyles = getLogRowStyles(useTheme2());
  const styles = useStyles2(getStyles);
  const dragStyles = useStyles2(getDragStyles);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { t } = useTranslate();

  const handleResize = useCallback(() => {
    if (containerRef.current) {
      setDetailsWidth(containerRef.current.clientWidth);
    }
    onResize();
  }, [onResize, setDetailsWidth]);

  const maxWidth = containerElement.clientWidth - LOG_LIST_MIN_WIDTH;

  return (
    <Resizable
      onResize={handleResize}
      handleClasses={{ left: dragStyles.dragHandleVertical }}
      defaultSize={{ width: detailsWidth, height: containerElement.clientHeight }}
      size={{ width: detailsWidth, height: containerElement.clientHeight }}
      enable={{ left: true }}
      minWidth={40}
      maxWidth={maxWidth}
    >
      <div className={styles.container} ref={containerRef}>
        <div className={styles.scrollContainer}>
          <IconButton
            name="times"
            className={styles.closeIcon}
            aria-label={t('logs.log-details.close', 'Close log details')}
            onClick={closeDetails}
          />
          <table width="100%">
            <tbody>
              <LogDetails
                getRows={getRows}
                mode="sidebar"
                row={showDetails[0]}
                showDuplicates={false}
                styles={logRowsStyles}
                wrapLogMessage={wrapLogMessage}
                onPinLine={onPinLine}
                getFieldLinks={getFieldLinks}
                onClickFilterLabel={onClickFilterLabel}
                onClickFilterOutLabel={onClickFilterOutLabel}
                onClickShowField={onClickShowField}
                onClickHideField={onClickHideField}
                hasError={showDetails[0].hasError}
                displayedFields={displayedFields}
                app={app}
                isFilterLabelActive={isLabelFilterActive}
                pinLineButtonTooltipTitle={pinLineButtonTooltipTitle}
              />
            </tbody>
          </table>
        </div>
      </div>
    </Resizable>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    overflow: 'auto',
    height: '100%',
  }),
  scrollContainer: css({
    overflow: 'auto',
    position: 'relative',
    height: '100%',
  }),
  closeIcon: css({
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(1.5),
  }),
});
