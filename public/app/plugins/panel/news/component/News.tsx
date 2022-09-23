import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, textUtil, dateTimeFormat } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { NewsItem } from '../types';

interface NewsItemProps {
  width: number;
  showImage?: boolean;
  data: NewsItem;
}

export function News({ width, showImage, data }: NewsItemProps) {
  const styles = useStyles2(getStyles);
  const useWideLayout = width > 600;

  return (
    <article className={cx(styles.item, useWideLayout && styles.itemWide)}>
      {showImage && data.ogImage && (
        <a
          tabIndex={-1}
          href={textUtil.sanitizeUrl(data.link)}
          target="_blank"
          rel="noopener noreferrer"
          className={cx(styles.socialImage, useWideLayout && styles.socialImageWide)}
          aria-hidden
        >
          <img src={data.ogImage} alt={data.title} />
        </a>
      )}
      <div className={styles.body}>
        <time className={styles.date} dateTime={dateTimeFormat(data.date, { format: 'MMM DD' })}>
          {dateTimeFormat(data.date, { format: 'MMM DD' })}{' '}
        </time>
        <a className={styles.link} href={textUtil.sanitizeUrl(data.link)} target="_blank" rel="noopener noreferrer">
          <h3 className={styles.title}>{data.title}</h3>
        </a>
        <div className={styles.content} dangerouslySetInnerHTML={{ __html: textUtil.sanitize(data.content) }} />
      </div>
    </article>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    height: 100%;
  `,
  item: css`
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
  itemWide: css`
    flex-direction: row;
  `,
  body: css`
    display: flex;
    flex-direction: column;
  `,
  socialImage: css`
    display: flex;
    align-items: center;
    margin-bottom: ${theme.spacing(1)};
    > img {
      width: 100%;
      border-radius: ${theme.shape.borderRadius(2)} ${theme.shape.borderRadius(2)} 0 0;
    }
  `,
  socialImageWide: css`
    margin-right: ${theme.spacing(2)};
    margin-bottom: 0;
    > img {
      width: 250px;
      border-radius: ${theme.shape.borderRadius()};
    }
  `,
  link: css`
    color: ${theme.colors.text.link};
    display: inline-block;

    &:hover {
      color: ${theme.colors.text.link};
      text-decoration: underline;
    }
  `,
  title: css`
    font-size: 16px;
    margin-bottom: ${theme.spacing(0.5)};
  `,
  content: css`
    p {
      margin-bottom: 4px;
      color: ${theme.colors.text};
    }
  `,
  date: css`
    margin-bottom: ${theme.spacing(0.5)};
    font-weight: 500;
    border-radius: 0 0 0 3px;
    color: ${theme.colors.text.secondary};
  `,
});
