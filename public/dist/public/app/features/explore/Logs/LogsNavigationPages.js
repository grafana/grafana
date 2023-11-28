import { css, cx } from '@emotion/css';
import React from 'react';
import { dateTimeFormat, systemDateFormats } from '@grafana/data';
import { CustomScrollbar, Spinner, useTheme2, clearButtonStyles } from '@grafana/ui';
export function LogsNavigationPages({ pages, currentPageIndex, oldestLogsFirst, timeZone, loading, onClick }) {
    const formatTime = (time) => {
        return `${dateTimeFormat(time, {
            format: systemDateFormats.interval.second,
            timeZone: timeZone,
        })}`;
    };
    const createPageContent = (page, index) => {
        if (currentPageIndex === index && loading) {
            return React.createElement(Spinner, null);
        }
        const topContent = formatTime(oldestLogsFirst ? page.logsRange.from : page.logsRange.to);
        const bottomContent = formatTime(oldestLogsFirst ? page.logsRange.to : page.logsRange.from);
        return `${topContent} — ${bottomContent}`;
    };
    const theme = useTheme2();
    const styles = getStyles(theme, loading);
    return (React.createElement(CustomScrollbar, { autoHide: true },
        React.createElement("div", { className: styles.pagesWrapper, "data-testid": "logsNavigationPages" },
            React.createElement("div", { className: styles.pagesContainer }, pages.map((page, index) => (React.createElement("button", { type: "button", "data-testid": `page${index + 1}`, className: cx(clearButtonStyles(theme), styles.page), key: page.queryRange.to, onClick: () => {
                    onClick(page, index + 1);
                } },
                React.createElement("div", { className: cx(styles.line, { selectedBg: currentPageIndex === index }) }),
                React.createElement("div", { className: cx(styles.time, { selectedText: currentPageIndex === index }) }, createPageContent(page, index)))))))));
}
const getStyles = (theme, loading) => {
    return {
        pagesWrapper: css `
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
        pagesContainer: css `
      display: flex;
      padding: 0;
      flex-direction: column;
    `,
        page: css `
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
        line: css `
      width: 3px;
      height: 100%;
      align-items: center;
      background: ${theme.colors.text.secondary};
    `,
        time: css `
      width: 60px;
      min-height: 80px;
      font-size: ${theme.v1.typography.size.sm};
      padding-left: ${theme.spacing(0.5)};
      display: flex;
      align-items: center;
    `,
    };
};
//# sourceMappingURL=LogsNavigationPages.js.map