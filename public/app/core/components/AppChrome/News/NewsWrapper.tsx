import { css } from '@emotion/css';
import { useEffect } from 'react';
import { useMeasure } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { News } from 'app/plugins/panel/news/component/News';
import { useNewsFeed } from 'app/plugins/panel/news/useNewsFeed';

import { t } from '../../../internationalization';

interface NewsWrapperProps {
  feedUrl: string;
}
export function NewsWrapper({ feedUrl }: NewsWrapperProps) {
  const styles = useStyles2(getStyles);
  const { state, getNews } = useNewsFeed(feedUrl);
  const [widthRef, widthMeasure] = useMeasure<HTMLDivElement>();

  useEffect(() => {
    getNews();
  }, [getNews]);

  if (state.error) {
    return <div className={styles.innerWrapper}>{state.error && state.error.message}</div>;
  }

  return (
    <div ref={widthRef}>
      {state.loading ? (
        <>
          <News.Skeleton showImage width={widthMeasure.width} />
          <News.Skeleton showImage width={widthMeasure.width} />
          <News.Skeleton showImage width={widthMeasure.width} />
          <News.Skeleton showImage width={widthMeasure.width} />
          <News.Skeleton showImage width={widthMeasure.width} />
        </>
      ) : (
        <>
          {widthMeasure.width > 0 &&
            state.value?.map((_, index) => (
              <News key={index} index={index} showImage width={widthMeasure.width} data={state.value} />
            ))}
        </>
      )}
      <div className={styles.grot}>
        <a
          href="https://grafana.com/blog/"
          target="_blank"
          rel="noreferrer"
          title={t('news.link-title', 'Go to Grafana labs blog')}
        >
          <img src="public/img/grot-news.svg" alt="Grot reading news" />
        </a>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    innerWrapper: css({
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    grot: css({
      display: `flex`,
      alignItems: `center`,
      justifyContent: `center`,
      padding: theme.spacing(5, 0),

      img: {
        width: `186px`,
        height: `186px`,
      },
    }),
  };
};
