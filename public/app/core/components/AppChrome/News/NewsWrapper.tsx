import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2 } from '@grafana/data';
import { LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { News } from 'app/plugins/panel/news/component/News';
import { useNewsFeed } from 'app/plugins/panel/news/useNewsFeed';

interface NewsWrapperProps {
  feedUrl: string;
}
export function NewsWrapper({ feedUrl }: NewsWrapperProps) {
  const styles = useStyles2(getStyles);
  const { state, getNews } = useNewsFeed(feedUrl);
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

  if (!state.value) {
    return null;
  }

  return (
    <AutoSizer>
      {({ width }) => (
        <div style={{ width: `${width}px` }}>
          {state.value.map((_, index) => (
            <News key={index} index={index} showImage width={width} data={state.value} />
          ))}
        </div>
      )}
    </AutoSizer>
  );
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
  };
};
