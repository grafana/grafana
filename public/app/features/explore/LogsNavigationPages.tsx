import { css, cx } from '@emotion/css';
import React from 'react';

import { dateTimeFormat, systemDateFormats, TimeZone, AbsoluteTimeRange, GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { CustomScrollbar, Spinner, useTheme2, clearButtonStyles } from '@grafana/ui';

import { LogsPage } from './LogsNavigation';

type Props = {
  pages: LogsPage[];
  currentPageIndex: number;
  oldestLogsFirst: boolean;
  timeZone: TimeZone;
  loading: boolean;
  changeTime: (range: AbsoluteTimeRange) => void;
};

export function LogsNavigationPages({
  pages,
  currentPageIndex,
  oldestLogsFirst,
  timeZone,
  loading,
  changeTime,
}: Props) {
  const formatTime = (time: number) => {
    return `${dateTimeFormat(time, {
      format: systemDateFormats.interval.second,
      timeZone: timeZone,
    })}`;
  };

  const createPageContent = (page: LogsPage, index: number) => {
    if (currentPageIndex === index && loading) {
      return <Spinner />;
    }
    const topContent = formatTime(oldestLogsFirst ? page.logsRange.from : page.logsRange.to);
    const bottomContent = formatTime(oldestLogsFirst ? page.logsRange.to : page.logsRange.from);
    return `${topContent} — ${bottomContent}`;
  };

  const theme = useTheme2();
  const styles = getStyles(theme, loading);

  return (
    <CustomScrollbar autoHide>
      <div className={styles.pagesWrapper} data-testid="logsNavigationPages">
        <div className={styles.pagesContainer}>
          {pages.map((page: LogsPage, index: number) => (
            <button
              type="button"
              data-testid={`page${index + 1}`}
              className={styles.page}
              key={page.queryRange.to}
              onClick={() => {
                reportInteraction('grafana_explore_logs_pagination_clicked', {
                  pageType: 'page',
                  pageNumber: index + 1,
                });
                !loading && changeTime({ from: page.queryRange.from, to: page.queryRange.to });
              }}
            >
              <div className={cx(styles.line, { selectedBg: currentPageIndex === index })} />
              <div className={cx(styles.time, { selectedText: currentPageIndex === index })}>
                {createPageContent(page, index)}
              </div>
            </button>
          ))}
        </div>
      </div>
    </CustomScrollbar>
  );
}

const getStyles = (theme: GrafanaTheme2, loading: boolean) => {
  return {
    pagesWrapper: css`
      height: 100%;
      padding-left: ${theme.spacing(0.5)};
      display: flex;
      flex-direction: column;
      overflow-y: scroll;
      &::after {
        content: '';
        display: block;
        background: repeating-linear-gradient(
          135deg,
          ${theme.colors.background.primary},
          ${theme.colors.background.primary} 5px,
          ${theme.colors.background.secondary} 5px,
          ${theme.colors.background.secondary} 15px
        );
        width: 3px;
        height: inherit;
        margin-bottom: 8px;
      }
    `,
    pagesContainer: css`
      display: flex;
      padding: 0;
      flex-direction: column;
    `,
    page: css`
      ${clearButtonStyles(theme)}
      display: flex;
      margin: ${theme.spacing(2)} 0;
      cursor: ${loading ? 'auto' : 'pointer'};
      white-space: normal;
      .selectedBg {
        background: ${theme.colors.primary.main};
      }
      .selectedText {
        color: ${theme.colors.primary.main};
      }
    `,
    line: css`
      width: 3px;
      height: 100%;
      align-items: center;
      background: ${theme.colors.text.secondary};
    `,
    time: css`
      width: 60px;
      min-height: 80px;
      font-size: ${theme.v1.typography.size.sm};
      padding-left: ${theme.spacing(0.5)};
      display: flex;
      align-items: center;
    `,
  };
};
