import { useEffect } from 'react';

import { PanelProps } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { RefreshEvent } from '@grafana/runtime';
import { Alert, ScrollContainer, TextLink } from '@grafana/ui';

import { News } from './component/News';
import { DEFAULT_FEED_URL } from './constants';
import { Options } from './panelcfg.gen';
import { useNewsFeed } from './useNewsFeed';

interface NewsPanelProps extends PanelProps<Options> {}

export function NewsPanel(props: NewsPanelProps) {
  const {
    width,
    options: { feedUrl = DEFAULT_FEED_URL, showImage },
  } = props;

  const { state, getNews } = useNewsFeed(feedUrl);

  useEffect(() => {
    const sub = props.eventBus.subscribe(RefreshEvent, getNews);

    return () => {
      sub.unsubscribe();
    };
  }, [getNews, props.eventBus]);

  useEffect(() => {
    getNews();
  }, [getNews]);

  if (state.error) {
    return (
      <Alert title={t('news.news-panel.title-error-loading-rss-feed', 'Error loading RSS feed')}>
        <Trans i18nKey="news.news-panel.body-error-loading-rss-feed">
          Make sure that the feed URL is correct and that CORS is configured correctly on the server. See{' '}
          <TextLink href="https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/news/" external>
            News panel documentation.
          </TextLink>
        </Trans>
      </Alert>
    );
  }
  if (state.loading) {
    return (
      <div>
        <Trans i18nKey="news.news-panel.loading">Loading...</Trans>
      </div>
    );
  }

  if (!state.value) {
    return null;
  }

  return (
    <ScrollContainer minHeight="100%">
      {state.value.map((_, index) => {
        return <News key={index} index={index} width={width} showImage={showImage} data={state.value} />;
      })}
    </ScrollContainer>
  );
}
