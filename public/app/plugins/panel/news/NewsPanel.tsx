// Libraries
import React, { PureComponent } from 'react';

// Utils & Services
import { CustomScrollbar, stylesFactory } from '@grafana/ui';

import config from 'app/core/config';
import { feedToDataFrame } from './utils';
import { loadRSSFeed } from './rss';

// Types
import { PanelProps, DataFrameView, dateTimeFormat, GrafanaTheme2, textUtil } from '@grafana/data';
import { NewsItem } from './types';
import { PanelOptions } from './models.gen';
import { DEFAULT_FEED_URL, PROXY_PREFIX } from './constants';
import { css, cx } from '@emotion/css';

interface Props extends PanelProps<PanelOptions> {}

interface State {
  news?: DataFrameView<NewsItem>;
  isError?: boolean;
}

export class NewsPanel extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {};
  }

  componentDidMount(): void {
    this.loadChannel();
  }

  componentDidUpdate(prevProps: Props): void {
    if (this.props.options.feedUrl !== prevProps.options.feedUrl) {
      this.loadChannel();
    }
  }

  async loadChannel() {
    const { options } = this.props;
    try {
      const url = options.feedUrl
        ? options.useProxy
          ? `${PROXY_PREFIX}${options.feedUrl}`
          : options.feedUrl
        : DEFAULT_FEED_URL;
      const res = await loadRSSFeed(url);
      const frame = feedToDataFrame(res);
      this.setState({
        news: new DataFrameView<NewsItem>(frame),
        isError: false,
      });
    } catch (err) {
      console.error('Error Loading News', err);
      this.setState({
        news: undefined,
        isError: true,
      });
    }
  }

  render() {
    const { width } = this.props;
    const { showImage } = this.props.options;
    const { isError, news } = this.state;
    const styles = getStyles(config.theme2);
    const useWideLayout = width > 600;

    if (isError) {
      return <div>Error Loading News</div>;
    }
    if (!news) {
      return <div>loading...</div>;
    }

    return (
      <CustomScrollbar autoHeightMin="100%" autoHeightMax="100%">
        {news.map((item, index) => {
          return (
            <article key={index} className={cx(styles.item, useWideLayout && styles.itemWide)}>
              {showImage && item.ogImage && (
                <a
                  href={textUtil.sanitizeUrl(item.link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cx(styles.socialImage, useWideLayout && styles.socialImageWide)}
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
          );
        })}
      </CustomScrollbar>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme2) => ({
  container: css`
    height: 100%;
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
  `,
  itemWide: css`
    flex-direction: row;
  `,
  body: css``,
  socialImage: css`
    display: flex;
    align-items: center;
    margin-bottom: ${theme.spacing(1)};
    > img {
      width: 100%;
      border-radius: ${theme.shape.borderRadius(2)} ${theme.shape.borderRadius(2)} 0 0;
    }
  `,
  socialImageWide: css`
    margin-right: ${theme.spacing(2)};
    margin-bottom: 0;
    > img {
      width: 250px;
      border-radius: ${theme.shape.borderRadius()};
    }
  `,
  link: css`
    color: ${theme.colors.text.link};

    &:hover {
      color: ${theme.colors.text.link};
      text-decoration: underline;
    }
  `,
  title: css`
    max-width: calc(100% - 70px);
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
}));
