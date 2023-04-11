import { css, cx } from '@emotion/css';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import usePrevious from 'react-use/lib/usePrevious';

import {
  DataQueryError,
  GrafanaTheme2,
  LogRowModel,
  LogsSortOrder,
  textUtil,
  DataSourceWithLogsContextSupport,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  Alert,
  Button,
  ClickOutsideWrapper,
  CustomScrollbar,
  IconButton,
  List,
  useStyles2,
  useTheme2,
} from '@grafana/ui';

import { LogMessageAnsi } from '../LogMessageAnsi';

import { HasMoreContextRows, LogRowContextQueryErrors, LogRowContextRows } from './LogRowContextProvider';

export enum LogGroupPosition {
  Bottom = 'bottom',
  Top = 'top',
}

interface LogRowContextProps {
  row: LogRowModel;
  context: LogRowContextRows;
  wrapLogMessage: boolean;
  errors?: LogRowContextQueryErrors;
  hasMoreContextRows?: HasMoreContextRows;
  logsSortOrder?: LogsSortOrder | null;
  onOutsideClick: (method: string) => void;
  onLoadMoreContext: () => void;
  runContextQuery?: () => void;
  getLogRowContextUi?: DataSourceWithLogsContextSupport['getLogRowContextUi'];
}

const getLogRowContextStyles = (theme: GrafanaTheme2, wrapLogMessage?: boolean, datasourceUiHeight?: number) => {
  if (!config.featureToggles.logsContextDatasourceUi || !datasourceUiHeight) {
    datasourceUiHeight = 0;
  }
  /**
   * This is workaround for displaying uncropped context when we have unwrapping log messages.
   * We are using margins to correctly position context. Because non-wrapped logs have always 1 line of log
   * and 1 line of Show/Hide context switch. Therefore correct position can be reliably achieved by margins.
   * We also adjust width to 75%.
   */

  const headerHeight = 40;
  const logsHeight = 220;
  const contextHeight = datasourceUiHeight + headerHeight + logsHeight;
  const bottomContextHeight = headerHeight + logsHeight;
  const width = wrapLogMessage ? '100%' : '75%';
  const afterContext = wrapLogMessage
    ? css`
        top: -${contextHeight}px;
      `
    : css`
        margin-top: -${contextHeight}px;
      `;

  const beforeContext = wrapLogMessage
    ? css`
        top: 100%;
      `
    : css`
        margin-top: ${theme.spacing(2.5)};
      `;
  return {
    width: css`
      width: ${width};
    `,
    bottomContext: css`
      height: ${bottomContextHeight}px;
    `,
    commonStyles: css`
      position: absolute;
      height: ${contextHeight}px;
      z-index: ${theme.zIndex.dropdown};
      overflow: hidden;
      background: ${theme.colors.background.primary};
      box-shadow: 0 0 ${theme.spacing(1.25)} ${theme.v1.palette.black};
      border: 1px solid ${theme.colors.background.secondary};
      border-radius: ${theme.shape.radius.default};
      font-family: ${theme.typography.fontFamily};
    `,
    header: css`
      height: ${headerHeight}px;
      padding: ${theme.spacing(0, 1.25)};
      display: flex;
      align-items: center;
      background: ${theme.colors.background.canvas};
    `,
    datasourceUi: css`
      height: ${datasourceUiHeight}px;
      padding: ${theme.spacing(0, 1.25)};
      display: flex;
      align-items: center;
      background: ${theme.colors.background.canvas};
    `,
    top: css`
      border-radius: 0 0 ${theme.shape.radius.default} ${theme.shape.radius.default};
      box-shadow: 0 0 ${theme.spacing(1.25)} ${theme.v1.palette.black};
      clip-path: inset(0px -${theme.spacing(1.25)} -${theme.spacing(1.25)} -${theme.spacing(1.25)});
    `,
    title: css`
      position: absolute;
      width: ${width};
      margin-top: -${contextHeight + headerHeight}px;
      z-index: ${theme.zIndex.modal};
      height: ${headerHeight}px;
      background: ${theme.colors.background.secondary};
      border: 1px solid ${theme.colors.background.secondary};
      border-radius: ${theme.shape.radius.default} ${theme.shape.radius.default} 0 0;
      box-shadow: 0 0 ${theme.spacing(1.25)} ${theme.v1.palette.black};
      clip-path: inset(-${theme.spacing(1.25)} -${theme.spacing(1.25)} 0px -${theme.spacing(1.25)});
      font-family: ${theme.typography.fontFamily};

      display: flex;
      flex-direction: row;
      align-items: center;

      padding: ${theme.spacing()};

      > h5 {
        margin: 0;
        flex: 1;
      }
    `,
    actions: css`
      align-items: center;
      display: flex;
    `,
    headerButton: css`
      margin-left: ${theme.spacing(1)};
    `,
    logs: css`
      height: ${logsHeight}px;
      padding: ${theme.spacing(1.25)};
      font-family: ${theme.typography.fontFamilyMonospace};

      .scrollbar-view {
        overscroll-behavior: contain;
      }
    `,

    afterContext,
    beforeContext,
  };
};

interface LogRowContextGroupHeaderProps {
  row: LogRowModel;
  rows: Array<string | DataQueryError>;
  onLoadMoreContext: () => void;
  groupPosition: LogGroupPosition;
  shouldScrollToBottom?: boolean;
  canLoadMoreRows?: boolean;
  logsSortOrder?: LogsSortOrder | null;
  getLogRowContextUi?: DataSourceWithLogsContextSupport['getLogRowContextUi'];
  runContextQuery?: () => void;
  onHeightChange?: (height: number) => void;
}
interface LogRowContextGroupProps extends LogRowContextGroupHeaderProps {
  rows: Array<string | DataQueryError>;
  groupPosition: LogGroupPosition;
  className?: string;
  error?: string;
}

const LogRowContextGroupHeader = ({
  row,
  rows,
  onLoadMoreContext,
  canLoadMoreRows,
  groupPosition,
  logsSortOrder,
  getLogRowContextUi,
  runContextQuery,
  onHeightChange,
}: LogRowContextGroupHeaderProps) => {
  const [height, setHeight] = useState(0);
  const datasourceUiRef = React.createRef<HTMLDivElement>();
  const theme = useTheme2();
  const { datasourceUi, header, headerButton } = getLogRowContextStyles(theme, undefined, height);

  // determine the position in time for this LogGroup by taking the ordering of
  // logs and position of the component itself into account.
  let logGroupPosition = 'after';
  if (groupPosition === LogGroupPosition.Bottom) {
    if (logsSortOrder === LogsSortOrder.Descending) {
      logGroupPosition = 'before';
    }
  } else if (logsSortOrder === LogsSortOrder.Ascending) {
    logGroupPosition = 'before';
  }

  if (config.featureToggles.logsContextDatasourceUi) {
    // disabling eslint here, because this condition does not change in runtime

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const resizeObserver = useMemo(
      () =>
        new ResizeObserver((entries) => {
          for (let entry of entries) {
            setHeight(entry.contentRect.height);
            if (onHeightChange) {
              onHeightChange(entry.contentRect.height);
            }
          }
        }),
      [onHeightChange]
    );

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useLayoutEffect(() => {
      // observe the first child of the ref, which is the datasource controlled component and varies in height
      // TODO: this is a bit of a hack and we can remove this as soon as we move back from the absolute positioned context
      const child = datasourceUiRef.current?.children.item(0);
      if (child) {
        resizeObserver.observe(child);
      }
      return () => {
        resizeObserver.disconnect();
      };
    }, [datasourceUiRef, resizeObserver]);
  }

  return (
    <>
      {config.featureToggles.logsContextDatasourceUi && getLogRowContextUi && (
        <div ref={datasourceUiRef} className={datasourceUi}>
          {getLogRowContextUi(row, runContextQuery)}
        </div>
      )}
      <div className={header}>
        <span
          className={css`
            opacity: 0.6;
          `}
        >
          Showing {rows.length} lines {logGroupPosition} match.
        </span>
        {(rows.length >= 10 || (rows.length > 10 && rows.length % 10 !== 0)) && canLoadMoreRows && (
          <Button className={headerButton} variant="secondary" size="sm" onClick={onLoadMoreContext}>
            Load 10 more lines
          </Button>
        )}
      </div>
    </>
  );
};

export const LogRowContextGroup = ({
  row,
  rows,
  error,
  className,
  shouldScrollToBottom,
  canLoadMoreRows,
  onLoadMoreContext,
  groupPosition,
  logsSortOrder,
  getLogRowContextUi,
  runContextQuery,
  onHeightChange,
}: LogRowContextGroupProps) => {
  const [height, setHeight] = useState(0);
  const theme = useTheme2();
  const { commonStyles, logs, bottomContext, afterContext } = getLogRowContextStyles(theme, undefined, height);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollHeight, setScrollHeight] = useState(0);

  const listContainerRef = useRef<HTMLDivElement>(null);
  const prevRows = usePrevious(rows);
  const prevScrollTop = usePrevious(scrollTop);
  const prevScrollHeight = usePrevious(scrollHeight);

  /**
   * This hook is responsible of keeping the right scroll position of the top
   * context when rows are added. Since rows are added at the top of the DOM,
   * the scroll position changes and we need to adjust the scrollTop.
   */
  useLayoutEffect(() => {
    if (!shouldScrollToBottom || !listContainerRef.current) {
      return;
    }

    const previousRowsLength = prevRows?.length ?? 0;
    const previousScrollHeight = prevScrollHeight ?? 0;
    const previousScrollTop = prevScrollTop ?? 0;
    const scrollElement = listContainerRef.current.parentElement;
    let currentScrollHeight = 0;

    if (scrollElement) {
      currentScrollHeight = scrollElement.scrollHeight - scrollElement.clientHeight;
      setScrollHeight(currentScrollHeight);
    }

    if (rows.length > previousRowsLength && currentScrollHeight > previousScrollHeight) {
      setScrollTop(previousScrollTop + (currentScrollHeight - previousScrollHeight));
    }
  }, [shouldScrollToBottom, rows, prevRows, prevScrollTop, prevScrollHeight]);

  /**
   * Keeps track of the scroll position of the list container.
   */
  const updateScroll = () => {
    const scrollElement = listContainerRef.current?.parentElement;
    if (scrollElement) {
      setScrollTop(listContainerRef.current?.parentElement.scrollTop);
    }
  };

  const changeHeight = (height: number) => {
    setHeight(height);
    if (onHeightChange) {
      onHeightChange(height);
    }
  };

  const headerProps = {
    row,
    rows,
    onLoadMoreContext,
    canLoadMoreRows,
    groupPosition,
    logsSortOrder,
    getLogRowContextUi,
    runContextQuery,
  };

  return (
    <div
      className={cx(commonStyles, className, groupPosition === LogGroupPosition.Bottom ? bottomContext : afterContext)}
    >
      {/* When displaying "after" context */}
      {shouldScrollToBottom && !error && <LogRowContextGroupHeader onHeightChange={changeHeight} {...headerProps} />}
      <div className={logs}>
        <CustomScrollbar autoHide onScroll={updateScroll} scrollTop={scrollTop} autoHeightMin={'210px'}>
          <div ref={listContainerRef}>
            {!error && (
              <List
                items={rows}
                renderItem={(item) => {
                  return (
                    <div
                      className={css`
                        padding: 5px 0;
                      `}
                    >
                      {typeof item === 'string' && textUtil.hasAnsiCodes(item) ? (
                        <LogMessageAnsi value={item} />
                      ) : (
                        String(item)
                      )}
                    </div>
                  );
                }}
              />
            )}
            {error && <Alert title={error} />}
          </div>
        </CustomScrollbar>
      </div>
      {/* When displaying "before" context */}
      {!shouldScrollToBottom && !error && <LogRowContextGroupHeader {...headerProps} />}
    </div>
  );
};

export const LogRowContext = ({
  row,
  context,
  errors,
  onOutsideClick,
  onLoadMoreContext,
  runContextQuery: runContextQuery,
  hasMoreContextRows,
  wrapLogMessage,
  logsSortOrder,
  getLogRowContextUi,
}: LogRowContextProps) => {
  useEffect(() => {
    const handleEscKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        onOutsideClick('close_esc');
      }
    };
    document.addEventListener('keydown', handleEscKeyDown, false);
    return () => {
      document.removeEventListener('keydown', handleEscKeyDown, false);
    };
  }, [onOutsideClick, row]);
  const [height, setHeight] = useState(0);
  const { beforeContext, title, top, actions, width } = useStyles2((theme) =>
    getLogRowContextStyles(theme, wrapLogMessage, height)
  );
  const handleOutsideClick = useCallback(() => onOutsideClick('close_outside_click'), [onOutsideClick]);

  return (
    <ClickOutsideWrapper onClick={handleOutsideClick}>
      {/* e.stopPropagation is necessary so the log details doesn't open when clicked on log line in context
       * and/or when context log line is being highlighted
       */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div onClick={(e) => e.stopPropagation()}>
        {context.after && (
          <LogRowContextGroup
            rows={context.after}
            error={errors && errors.after}
            row={row}
            className={cx(top, width)}
            shouldScrollToBottom
            canLoadMoreRows={hasMoreContextRows ? hasMoreContextRows.after : false}
            onLoadMoreContext={onLoadMoreContext}
            groupPosition={LogGroupPosition.Top}
            logsSortOrder={logsSortOrder}
            getLogRowContextUi={getLogRowContextUi}
            runContextQuery={runContextQuery}
            onHeightChange={setHeight}
          />
        )}

        {context.before && (
          <LogRowContextGroup
            onLoadMoreContext={onLoadMoreContext}
            canLoadMoreRows={hasMoreContextRows ? hasMoreContextRows.before : false}
            row={row}
            rows={context.before}
            error={errors && errors.before}
            className={cx(beforeContext, width)}
            groupPosition={LogGroupPosition.Bottom}
            logsSortOrder={logsSortOrder}
          />
        )}
        <div className={cx(title, width)}>
          <h5>Log context</h5>
          <div className={actions}>
            <IconButton size="lg" name="times" onClick={() => onOutsideClick('close_button')} />
          </div>
        </div>
      </div>
    </ClickOutsideWrapper>
  );
};
