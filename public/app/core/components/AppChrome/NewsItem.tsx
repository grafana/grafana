import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { useAsyncFn } from 'react-use';

import { GrafanaTheme2, textUtil, dateTimeFormat } from '@grafana/data';
import { useStyles2, LoadingPlaceholder } from '@grafana/ui';

import { fetchNews } from './api';

export function NewsItem() {
  const styles = useStyles2(getStyles);
  const [state, getNews] = useAsyncFn(fetchNews, undefined, { loading: true });
  useEffect(() => {
    getNews();
  }, [getNews]);

  if (state.loading || state.error) {
    return (
      <div className={styles.innerWrapper}>
        {state.loading && <LoadingPlaceholder text="Loading..." />}
        {state.error && state.error.message}
      </div>
    );
  }

  if (state.value) {
    return (
      <>
        {state.value.map((item, index) => (
          <article key={index} className={styles.item}>
            {item.ogImage && (
              <a
                tabIndex={-1}
                href={textUtil.sanitizeUrl(item.link)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialImage}
                aria-hidden
              >
                <img src={item.ogImage} alt={item.title} />
              </a>
            )}
            <div className={styles.body}>
              <time className={styles.date} dateTime={dateTimeFormat(item.date, { format: 'MMM DD' })}>
                {dateTimeFormat(item.date, { format: 'MMM DD' })}{' '}
              </time>
              <a
                className={styles.link}
                href={textUtil.sanitizeUrl(item.link)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <h3 className={styles.title}>{item.title}</h3>
              </a>
              <div className={styles.content} dangerouslySetInnerHTML={{ __html: textUtil.sanitize(item.content) }} />
            </div>
          </article>
        ))}
      </>
    );
  }

  return null;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    innerWrapper: css`
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
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

      @media (min-width: ${theme.breakpoints.values.lg}px) {
        flex-direction: row;
      }
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

      @media (min-width: ${theme.breakpoints.values.lg}px) {
        margin-right: ${theme.spacing(2)};
        margin-bottom: 0;
        > img {
          width: 250px;
          border-radius: ${theme.shape.borderRadius()};
        }
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
  };
};
