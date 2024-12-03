import { useEffect } from 'react';

import { PanelProps } from '@grafana/data';
import { RefreshEvent } from '@grafana/runtime';
import { Alert, Icon, ScrollContainer } from '@grafana/ui';

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
      <Alert title="Error loading RSS feed">
        Make sure that the feed URL is correct and that CORS is configured correctly on the server. See{' '}
        <a
          style={{ textDecoration: 'underline' }}
          href="https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/news/"
        >
          News panel documentation. <Icon name="external-link-alt" />
        </a>
      </Alert>
    );
  }
  if (state.loading) {
    return <div>Loading...</div>;
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
