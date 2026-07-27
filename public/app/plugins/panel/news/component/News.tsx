import { css, cx } from '@emotion/css';
import { useId } from 'react';
import Skeleton from 'react-loading-skeleton';

import { type DataFrameView, type GrafanaTheme2, textUtil, dateTimeFormat } from '@grafana/data';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { TextLink, useStyles2 } from '@grafana/ui';
import { attachSkeleton, type SkeletonComponent } from '@grafana/ui/unstable';

import { type NewsItem } from '../types';

interface NewsItemProps {
  showImage?: boolean;
  index: number;
  data: DataFrameView<NewsItem>;
  className?: string;
}

function NewsComponent({ showImage, data, index, className }: NewsItemProps) {
  const titleId = useId();
  const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
  const styles = useStyles2(getStyles, visualRefreshEnabled);
  const newsItem = data.get(index);

  return (
    <article aria-labelledby={titleId} className={cx(styles.item, className)}>
      {showImage && newsItem.ogImage && (
        <a
          tabIndex={-1}
          href={textUtil.sanitizeUrl(newsItem.link)}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.socialImage}
          aria-hidden
        >
          <img src={newsItem.ogImage} alt={newsItem.title} />
        </a>
      )}
      <div className={styles.body}>
        <time className={styles.date} dateTime={dateTimeFormat(newsItem.date, { format: 'MMM DD' })}>
          {dateTimeFormat(newsItem.date, { format: 'MMM DD' })}{' '}
        </time>

        <h1 className={styles.title} id={titleId}>
          <TextLink href={textUtil.sanitizeUrl(newsItem.link)} external inline={false}>
            {newsItem.title}
          </TextLink>
        </h1>
        <div className={styles.content} dangerouslySetInnerHTML={{ __html: textUtil.sanitize(newsItem.content) }} />
      </div>
    </article>
  );
}

const NewsSkeleton: SkeletonComponent<Pick<NewsItemProps, 'showImage'>> = ({ showImage, rootProps }) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.item} {...rootProps}>
      {showImage && <Skeleton containerClassName={styles.socialImage} width="100%" style={{ aspectRatio: '16 / 9' }} />}
      <div className={styles.body}>
        <Skeleton containerClassName={styles.date} width={60} />
        <Skeleton containerClassName={styles.title} width={250} />
        <Skeleton containerClassName={styles.content} width="100%" count={6} />
      </div>
    </div>
  );
};

export const News = attachSkeleton(NewsComponent, NewsSkeleton);

const getStyles = (theme: GrafanaTheme2, visualRefreshEnabled?: boolean) => ({
  container: css({
    height: '100%',
  }),
  item: css({
    display: 'flex',
    padding: theme.spacing(1),
    gap: theme.spacing(2),
    position: 'relative',
    marginBottom: theme.spacing(0.5),
    marginRight: theme.spacing(1),
    borderBottom: `2px solid ${theme.colors.border.weak}`,
    background: visualRefreshEnabled ? theme.components.panel.background : theme.colors.background.primary,
    flexDirection: 'row',
    flexShrink: 0,
  }),
  body: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  }),
  socialImage: css({
    display: 'flex',
    alignItems: 'center',
    width: '33.33%',
    maxWidth: '250px',
    '> img': {
      width: '100%',
      borderRadius: theme.shape.radius.lg,
    },
  }),
  title: css({
    ...theme.typography.h3,
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
    color: theme.colors.text.secondary,
  }),
});
