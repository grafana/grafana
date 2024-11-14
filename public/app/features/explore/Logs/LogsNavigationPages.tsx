import { css, cx } from '@emotion/css';

import { dateTimeFormat, systemDateFormats, GrafanaTheme2 } from '@grafana/data';
import { TimeZone } from '@grafana/schema';
import { ScrollContainer, Spinner, useTheme2, clearButtonStyles } from '@grafana/ui';

import { LogsPage } from './LogsNavigation';

type Props = {
  pages: LogsPage[];
  currentPageIndex: number;
  oldestLogsFirst: boolean;
  timeZone: TimeZone;
  loading: boolean;
  onClick: (page: LogsPage, pageNumber: number) => void;
};

export function LogsNavigationPages({ pages, currentPageIndex, oldestLogsFirst, timeZone, loading, onClick }: Props) {
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
    <ScrollContainer>
      <div className={styles.pagesWrapper} data-testid="logsNavigationPages">
        <div className={styles.pagesContainer}>
          {pages.map((page: LogsPage, index: number) => (
            <button
              type="button"
              data-testid={`page${index + 1}`}
              className={cx(clearButtonStyles(theme), styles.page)}
              key={page.queryRange.to}
              onClick={() => {
                onClick(page, index + 1);
              }}
              disabled={loading}
            >
              <div className={cx(styles.line, { selectedBg: currentPageIndex === index })} />
              <div className={cx(styles.time, { selectedText: currentPageIndex === index })}>
                {createPageContent(page, index)}
              </div>
            </button>
          ))}
        </div>
      </div>
    </ScrollContainer>
  );
}

const getStyles = (theme: GrafanaTheme2, loading: boolean) => {
  return {
    pagesWrapper: css({
      height: '100%',
      paddingLeft: theme.spacing(0.5),
      display: 'flex',
      flexDirection: 'column',
      '&::after': {
        content: "''",
        display: 'block',
        background: `repeating-linear-gradient(135deg, ${theme.colors.background.primary}, ${theme.colors.background.primary} 5px, ${theme.colors.background.secondary} 5px, ${theme.colors.background.secondary} 15px)`,
        width: '3px',
        height: 'inherit',
        marginBottom: theme.spacing(1),
      },
    }),
    pagesContainer: css({
      display: 'flex',
      padding: 0,
      flexDirection: 'column',
    }),
    page: css({
      display: 'flex',
      margin: theme.spacing(2, 0),
      cursor: loading ? 'auto' : 'pointer',
      whiteSpace: 'normal',
      '.selectedBg': {
        background: theme.colors.primary.main,
      },
      '.selectedText': {
        color: theme.colors.primary.main,
      },
    }),
    line: css({
      width: '3px',
      height: '100%',
      alignItems: 'center',
      background: theme.colors.text.secondary,
    }),
    time: css({
      width: '60px',
      minHeight: '80px',
      fontSize: theme.v1.typography.size.sm,
      paddingLeft: theme.spacing(0.5),
      display: 'flex',
      alignItems: 'center',
    }),
  };
};
