import React, { PureComponent } from 'react';
import RssParser from 'rss-parser';

import { PanelProps, DataFrameView, dateTime } from '@grafana/data';
import { RssFeed, NewsOptions, NewsItem } from './types';
import { feedToDataFrame } from './utils';

interface Props extends PanelProps<NewsOptions> {}

interface State {
  news?: DataFrameView<NewsItem>;
  isError?: boolean;
}

const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';

export class NewsPanel extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {};
  }

  componentDidMount(): void {
    this.loadFeed(this.props.options.feedUrl);
  }

  componentDidUpdate(prevProps: Props): void {
    if (this.props.options.feedUrl !== prevProps.options.feedUrl) {
      this.loadFeed(this.props.options.feedUrl);
    }
  }

  async loadFeed(feedUrl: string) {
    const parser = new RssParser();

    try {
      const res = (await parser.parseURL(CORS_PROXY + feedUrl)) as RssFeed;
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

    if (isError) {
      return <div>Error Loading News</div>;
    }
    if (!news) {
      return <div>loading...</div>;
    }

    return (
      <div
        style={{
          maxHeight: '100%',
          overflow: 'auto',
        }}
      >
        {news.map((item, index) => {
          return (
            <div key={index}>
              <a href={item.link} target="_blank">
                <div style={{ display: 'flex', padding: '4px 0' }}>
                  <div>
                    <small>{dateTime(item.date).format('LLL')}</small>
                  </div>
                  <div>{item.title}</div>
                </div>
              </a>
            </div>
          );
        })}
      </div>
    );
  }
}
