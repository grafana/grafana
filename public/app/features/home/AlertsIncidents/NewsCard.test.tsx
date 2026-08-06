import { render, screen } from 'test/test-utils';

import { DataFrameView } from '@grafana/data';
import { type Feed } from 'app/plugins/panel/news/types';
import { useNewsFeed } from 'app/plugins/panel/news/useNewsFeed';
import { feedToDataFrame } from 'app/plugins/panel/news/utils';

import { ctaClicked } from '../analytics/main';

import { NewsCard } from './NewsCard';

jest.mock('app/plugins/panel/news/useNewsFeed');
jest.mock('../analytics/main', () => ({
  ctaClicked: jest.fn(),
}));

const mockUseNewsFeed = jest.mocked(useNewsFeed);

type FeedState = ReturnType<typeof useNewsFeed>['state'];

const stubFeed: Feed = {
  items: [
    { title: 'Post One', link: 'https://example.com/1', pubDate: '2024-01-01', content: 'Content one' },
    { title: 'Post Two', link: 'https://example.com/2', pubDate: '2024-01-02', content: 'Content two' },
  ],
};

function makeFeedValue(): NonNullable<FeedState['value']> {
  return new DataFrameView(feedToDataFrame(stubFeed));
}

function setFeedState(state: Partial<FeedState>, getNews = jest.fn()) {
  mockUseNewsFeed.mockReturnValue({
    state: { loading: false, error: undefined, value: undefined, ...state } as FeedState,
    getNews,
  });
}

describe('NewsCard', () => {
  beforeEach(() => {
    setFeedState({ value: makeFeedValue() });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('fires the news_detail cta event when a news item is clicked', async () => {
    const { user } = render(<NewsCard />);

    await user.click(screen.getByRole('link', { name: 'Post One' }));

    expect(ctaClicked).toHaveBeenCalledWith({
      surface: 'news_card',
      action: 'news_detail',
      placement: 'list',
    });
  });

  it('fires the read_more_news cta event when the footer link is clicked', async () => {
    const { user } = render(<NewsCard />);

    await user.click(screen.getByRole('link', { name: 'Read more from the Grafana Labs blog' }));

    expect(ctaClicked).toHaveBeenCalledWith({
      surface: 'news_card',
      action: 'read_more_news',
      placement: 'footer',
    });
  });
});
