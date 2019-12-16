import React, { PureComponent } from 'react';
import RssParser from 'rss-parser';

import { PanelProps } from '@grafana/data';
import { RssFeedRow } from './RssFeedRow';
import { RssFeed, NewsOptions } from '../types';

interface Props extends PanelProps<NewsOptions> {}

interface State {
  rssFeed: RssFeed;
  isError: boolean;
}

const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';

export class NewsPanel extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      rssFeed: {} as RssFeed,
      isError: false,
    };
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
      console.log('FEED', res);
      this.setState({
        rssFeed: res,
        isError: false,
      });
    } catch (err) {
      console.error(err);
      this.setState({ isError: true });
    }
  }

  render() {
    const { isError, rssFeed } = this.state;

    if (rssFeed.items && rssFeed.items.length > 1) {
      return (
        <div
          style={{
            maxHeight: '100%',
            overflow: 'auto',
          }}
        >
          {rssFeed.items.map((item, index) => {
            return <RssFeedRow key={`${item.created}-${index}`} item={item} />;
          })}
        </div>
      );
    }

    if (isError) {
      return <div>Error :(</div>;
    }

    return <div>Loading...</div>;
  }
}
