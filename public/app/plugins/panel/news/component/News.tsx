import { css, cx } from '@emotion/css';
import { useId } from 'react';
import Skeleton from 'react-loading-skeleton';

import { DataFrameView, GrafanaTheme2, textUtil, dateTimeFormat } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { attachSkeleton, SkeletonComponent } from '@grafana/ui/unstable';

import { NewsItem } from '../types';

interface NewsItemProps {
  width: number;
  showImage?: boolean;
  index: number;
  data: DataFrameView<NewsItem>;
}

function NewsComponent({ width, showImage, data, index }: NewsItemProps) {
  const titleId = useId();
  const styles = useStyles2(getStyles);
  const useWideLayout = width > 600;
  const newsItem = data.get(index);

  return (
    <article aria-labelledby={titleId} className={cx(styles.item, useWideLayout && styles.itemWide)}>
      {showImage && newsItem.ogImage && (
        <a
          tabIndex={-1}
          href={textUtil.sanitizeUrl(newsItem.link)}
          target="_blank"
          rel="noopener noreferrer"
          className={cx(styles.socialImage, useWideLayout && styles.socialImageWide)}
          aria-hidden
        >
          <img src={newsItem.ogImage} alt={newsItem.title} />
        </a>
      )}
      <div className={styles.body}>
        <time className={styles.date} dateTime={dateTimeFormat(newsItem.date, { format: 'MMM DD' })}>
          {dateTimeFormat(newsItem.date, { format: 'MMM DD' })}{' '}
        </time>
        <a className={styles.link} href={textUtil.sanitizeUrl(newsItem.link)} target="_blank" rel="noopener noreferrer">
          <h3 className={styles.title} id={titleId}>
            {newsItem.title}
          </h3>
        </a>
        <div className={styles.content} dangerouslySetInnerHTML={{ __html: textUtil.sanitize(newsItem.content) }} />
      </div>
    </article>
  );
}

const NewsSkeleton: SkeletonComponent<Pick<NewsItemProps, 'width' | 'showImage'>> = ({
  width,
  showImage,
  rootProps,
}) => {
  const styles = useStyles2(getStyles);
  const useWideLayout = width > 600;

  return (
    <div className={cx(styles.item, useWideLayout && styles.itemWide)} {...rootProps}>
      {showImage && (
        <Skeleton
          containerClassName={cx(styles.socialImage, useWideLayout && styles.socialImageWide)}
          width={useWideLayout ? '250px' : '100%'}
          height={useWideLayout ? '150px' : width * 0.5}
        />
      )}
      <div className={styles.body}>
        <Skeleton containerClassName={styles.date} width={60} />
        <Skeleton containerClassName={styles.title} width={250} />
        <Skeleton containerClassName={styles.content} width="100%" count={6} />
      </div>
    </div>
  );
};

export const News = attachSkeleton(NewsComponent, NewsSkeleton);

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    height: '100%',
  }),
  item: css({
    display: 'flex',
    padding: theme.spacing(1),
    position: 'relative',
    marginBottom: theme.spacing(0.5),
    marginRight: theme.spacing(1),
    borderBottom: `2px solid ${theme.colors.border.weak}`,
    background: theme.colors.background.primary,
    flexDirection: 'column',
    flexShrink: 0,
  }),
  itemWide: css({
    flexDirection: 'row',
  }),
  body: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  }),
  socialImage: css({
    display: 'flex',
    alignItems: 'center',
    marginBottom: theme.spacing(1),
    '> img': {
      width: '100%',
      borderRadius: `${theme.shape.radius.default} ${theme.shape.radius.default} 0 0`,
    },
  }),
  socialImageWide: css({
    marginRight: theme.spacing(2),
    marginBottom: 0,
    '> img': {
      width: '250px',
      borderRadius: theme.shape.radius.default,
    },
  }),
  link: css({
    color: theme.colors.text.link,
    display: 'inline-block',

    '&:hover': {
      color: theme.colors.text.link,
      textDecoration: 'underline',
    },
  }),
  title: css({
    fontSize: '16px',
    marginBottom: theme.spacing(0.5),
  }),
  content: css({
    p: {
      marginBottom: theme.spacing(0.5),
      color: theme.colors.text.primary,
    },
  }),
  date: css({
    marginBottom: theme.spacing(0.5),
    fontWeight: 500,
    borderRadius: `0 0 0 ${theme.shape.radius.default}`,
    color: theme.colors.text.secondary,
  }),
});
