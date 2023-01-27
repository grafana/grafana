import React, { useEffect } from 'react';

import { PanelProps } from '@grafana/data';
import { RefreshEvent } from '@grafana/runtime';
import { CustomScrollbar } from '@grafana/ui';

import { News } from './component/News';
import { DEFAULT_FEED_URL } from './constants';
import { PanelOptions } from './panelcfg.gen';
import { useNewsFeed } from './useNewsFeed';

interface NewsPanelProps extends PanelProps<PanelOptions> {}

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
    return <div>Error loading RSS feed.</div>;
  }
  if (state.loading) {
    return <div>Loading...</div>;
  }

  if (!state.value) {
    return null;
  }

  return (
    <CustomScrollbar autoHeightMin="100%" autoHeightMax="100%">
      {state.value.map((_, index) => {
        return <News key={index} index={index} width={width} showImage={showImage} data={state.value} />;
      })}
    </CustomScrollbar>
  );
}
