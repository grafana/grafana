import { css } from '@emotion/css';
import { useEffect } from 'react';
import { useMeasure } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';
import { News } from 'app/plugins/panel/news/component/News';
import { DEFAULT_FEED_URL } from 'app/plugins/panel/news/constants';
import { useNewsFeed } from 'app/plugins/panel/news/useNewsFeed';

import { FooterAction, FooterActions } from '../FooterActions';
import { ctaClicked } from '../analytics/main';

import { SummaryCard } from './SummaryCard';

export function NewsCard() {
  const styles = useStyles2(getStyles);
  const { state, getNews } = useNewsFeed(DEFAULT_FEED_URL);
  const [widthRef, widthMeasure] = useMeasure<HTMLUListElement>();

  useEffect(() => {
    getNews();
  }, [getNews]);

  return (
    <SummaryCard
      title={t('home.news-card.title', 'Latest from the blog')}
      loading={state.loading}
      error={
        state.error
          ? { title: t('home.news-card.error-title', 'Could not load recent blog posts'), onRetry: () => getNews() }
          : undefined
      }
      emptyMessage={t('home.news-card.empty', 'No recent blog posts.')}
      items={state.value?.map((_, index) => index) || []}
      getItemKey={(index) => String(index)}
      renderItem={(index) =>
        state.value && (
          <News showImage width={widthMeasure.width} data={state.value} index={index} className={styles.post} />
        )
      }
      ref={widthRef}
      footer={
        !!state.value?.length && (
          <FooterActions>
            <FooterAction
              icon="rss"
              href="https://grafana.com/blog/"
              external
              onClick={() => ctaClicked({ surface: 'news_card', action: 'read_more_news', placement: 'footer' })}
            >
              <Trans i18nKey="home.news-card.read-more">Read more from the Grafana Labs blog</Trans>
            </FooterAction>
          </FooterActions>
        )
      }
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  post: css({
    background: 'none',
    padding: theme.spacing(0, 0, 1.25),
    margin: 0,

    'a:has(img)': {
      alignItems: 'flex-start',
    },
  }),
});
