import React from 'react';
import { css, cx } from 'emotion';
import { dateTimeFormat, systemDateFormats, TimeZone, GrafanaTheme, AbsoluteTimeRange } from '@grafana/data';
import { useTheme, stylesFactory, CustomScrollbar, Spinner } from '@grafana/ui';
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

  const theme = useTheme();
  const styles = getStyles(theme, loading);

  return (
    <CustomScrollbar autoHide>
      <div className={styles.pagesWrapper} data-testid="logsNavigationPages">
        <div className={styles.pagesContainer}>
          {pages.map((page: LogsPage, index: number) => (
            <div
              data-testid={`page${index + 1}`}
              className={styles.page}
              key={page.queryRange.to}
              onClick={() => !loading && changeTime({ from: page.queryRange.from, to: page.queryRange.to })}
            >
              <div className={cx(styles.line, { selectedBg: currentPageIndex === index })} />
              <div className={cx(styles.time, { selectedText: currentPageIndex === index })}>
                {createPageContent(page, index)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </CustomScrollbar>
  );
}

const getStyles = stylesFactory((theme: GrafanaTheme, loading: boolean) => {
  return {
    pagesWrapper: css`
      height: 100%;
      padding-left: ${theme.spacing.xs};
      display: flex;
      flex-direction: column;
      overflow-y: scroll;
      &::after {
        content: '';
        display: block;
        background: repeating-linear-gradient(
          135deg,
          ${theme.colors.bg1},
          ${theme.colors.bg1} 5px,
          ${theme.colors.bg2} 5px,
          ${theme.colors.bg2} 15px
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
      display: flex;
      margin: ${theme.spacing.md} 0;
      cursor: ${loading ? 'auto' : 'pointer'};
      white-space: normal;
      .selectedBg {
        background: ${theme.colors.bgBlue2};
      }
      .selectedText {
        color: ${theme.colors.bgBlue2};
      }
    `,
    line: css`
      width: 3px;
      height: 100%;
      align-items: center;
      background: ${theme.colors.textWeak};
    `,
    time: css`
      width: 60px;
      min-height: 80px;
      font-size: ${theme.typography.size.sm};
      padding-left: ${theme.spacing.xs};
      display: flex;
      align-items: center;
    `,
  };
});
