import { css, cx } from '@emotion/css';
import React from 'react';
import { textUtil, dateTimeFormat } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
export function News({ width, showImage, data, index }) {
    const styles = useStyles2(getStyles);
    const useWideLayout = width > 600;
    const newsItem = data.get(index);
    return (React.createElement("article", { className: cx(styles.item, useWideLayout && styles.itemWide) },
        showImage && newsItem.ogImage && (React.createElement("a", { tabIndex: -1, href: textUtil.sanitizeUrl(newsItem.link), target: "_blank", rel: "noopener noreferrer", className: cx(styles.socialImage, useWideLayout && styles.socialImageWide), "aria-hidden": true },
            React.createElement("img", { src: newsItem.ogImage, alt: newsItem.title }))),
        React.createElement("div", { className: styles.body },
            React.createElement("time", { className: styles.date, dateTime: dateTimeFormat(newsItem.date, { format: 'MMM DD' }) },
                dateTimeFormat(newsItem.date, { format: 'MMM DD' }),
                ' '),
            React.createElement("a", { className: styles.link, href: textUtil.sanitizeUrl(newsItem.link), target: "_blank", rel: "noopener noreferrer" },
                React.createElement("h3", { className: styles.title }, newsItem.title)),
            React.createElement("div", { className: styles.content, dangerouslySetInnerHTML: { __html: textUtil.sanitize(newsItem.content) } }))));
}
const getStyles = (theme) => ({
    container: css `
    height: 100%;
  `,
    item: css `
    display: flex;
    padding: ${theme.spacing(1)};
    position: relative;
    margin-bottom: 4px;
    margin-right: ${theme.spacing(1)};
    border-bottom: 2px solid ${theme.colors.border.weak};
    background: ${theme.colors.background.primary};
    flex-direction: column;
    flex-shrink: 0;
  `,
    itemWide: css `
    flex-direction: row;
  `,
    body: css `
    display: flex;
    flex-direction: column;
  `,
    socialImage: css `
    display: flex;
    align-items: center;
    margin-bottom: ${theme.spacing(1)};
    > img {
      width: 100%;
      border-radius: ${theme.shape.radius.default} ${theme.shape.radius.default} 0 0;
    }
  `,
    socialImageWide: css `
    margin-right: ${theme.spacing(2)};
    margin-bottom: 0;
    > img {
      width: 250px;
      border-radius: ${theme.shape.radius.default};
    }
  `,
    link: css `
    color: ${theme.colors.text.link};
    display: inline-block;

    &:hover {
      color: ${theme.colors.text.link};
      text-decoration: underline;
    }
  `,
    title: css `
    font-size: 16px;
    margin-bottom: ${theme.spacing(0.5)};
  `,
    content: css `
    p {
      margin-bottom: 4px;
      color: ${theme.colors.text};
    }
  `,
    date: css `
    margin-bottom: ${theme.spacing(0.5)};
    font-weight: 500;
    border-radius: 0 0 0 ${theme.shape.radius.default};
    color: ${theme.colors.text.secondary};
  `,
});
//# sourceMappingURL=News.js.map