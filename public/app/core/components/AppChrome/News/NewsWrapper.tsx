import { css } from '@emotion/css';
import { useEffect } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';
import { News } from 'app/plugins/panel/news/component/News';
import { useNewsFeed } from 'app/plugins/panel/news/useNewsFeed';
import grotNewsSvg from 'img/grot-news.svg';

interface NewsWrapperProps {
  feedUrl: string;
}
export function NewsWrapper({ feedUrl }: NewsWrapperProps) {
  const styles = useStyles2(getStyles);
  const { state, getNews } = useNewsFeed(feedUrl);

  useEffect(() => {
    getNews();
  }, [getNews]);

  if (state.error) {
    return <div className={styles.innerWrapper}>{state.error && state.error.message}</div>;
  }

  return (
    <div>
      {state.loading ? (
        <>
          <News.Skeleton showImage />
          <News.Skeleton showImage />
          <News.Skeleton showImage />
          <News.Skeleton showImage />
          <News.Skeleton showImage />
        </>
      ) : (
        <>
          {state.value?.map((_, index) => (
            <News key={index} index={index} showImage data={state.value} />
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
          <img src={grotNewsSvg} alt="Grot reading news" />
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
