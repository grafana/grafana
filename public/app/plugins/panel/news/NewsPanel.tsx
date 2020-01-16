// Libraries
import React, { PureComponent } from 'react';
import { css } from 'emotion';

// Utils & Services
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, CustomScrollbar, styleMixins } from '@grafana/ui';
import config from 'app/core/config';
import { feedToDataFrame } from './utils';
import { sanitize } from 'app/core/utils/text';
import { loadRSSFeed } from './rss';

// Types
import { PanelProps, DataFrameView, dateTime } from '@grafana/data';
import { NewsOptions, NewsItem, DEFAULT_FEED_URL } from './types';

interface Props extends PanelProps<NewsOptions> {}

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
    this.loadFeed();
  }

  componentDidUpdate(prevProps: Props): void {
    if (this.props.options.feedUrl !== prevProps.options.feedUrl) {
      this.loadFeed();
    }
  }

  async loadFeed() {
    const { options } = this.props;
    try {
      const url = options.feedUrl ?? DEFAULT_FEED_URL;
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
    const { isError, news } = this.state;
    const styles = getStyles(config.theme);

    if (isError) {
      return <div>Error Loading News</div>;
    }
    if (!news) {
      return <div>loading...</div>;
    }

    return (
      <div className={styles.container}>
        <CustomScrollbar>
          {news.map((item, index) => {
            return (
              <div key={index} className={styles.item}>
                <a href={item.link} target="_blank">
                  <div className={styles.title}>{item.title}</div>
                  <div className={styles.date}>{dateTime(item.date).format('MMM DD')} </div>
                  <div className={styles.content} dangerouslySetInnerHTML={{ __html: sanitize(item.content) }} />
                </a>
              </div>
            );
          })}
        </CustomScrollbar>
      </div>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  container: css`
    height: 100%;
  `,
  item: css`
    ${styleMixins.listItem(theme)}
    padding: ${theme.spacing.sm};
    position: relative;
    margin-bottom: 4px;
    margin-right: ${theme.spacing.sm};
  `,
  title: css`
    color: ${theme.colors.linkExternal};
    max-width: calc(100% - 70px);
    font-size: 16px;
    margin-bottom: ${theme.spacing.sm};
  `,
  content: css`
    p {
      margin-bottom: 4px;
    }
  `,
  date: css`
    position: absolute;
    top: 0;
    right: 0;
    background: ${theme.colors.panelBg};
    width: 55px;
    text-align: right;
    padding: ${theme.spacing.xs};
    font-weight: 500;
    border-radius: 0 0 0 3px;
    color: ${theme.colors.textWeak};
  `,
}));
