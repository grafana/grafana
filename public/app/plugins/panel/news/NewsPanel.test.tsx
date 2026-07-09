import { render, screen } from '@testing-library/react';

import { EventBusSrv } from '@grafana/data';
import { RefreshEvent } from '@grafana/runtime';

import { getPanelProps } from '../test-utils';

import { NewsPanel } from './NewsPanel';
import { DEFAULT_FEED_URL } from './constants';
import { defaultOptions, type Options } from './panelcfg.gen';
import { useNewsFeed } from './useNewsFeed';

jest.mock('./useNewsFeed');
jest.mock('./component/News', () => ({
  News: ({ index }: { index: number }) => <div data-testid="news-item">item-{index}</div>,
}));

const useNewsFeedMock = jest.mocked(useNewsFeed);

type FeedState = ReturnType<typeof useNewsFeed>['state'];

function setFeedState(state: Partial<FeedState>, getNews = jest.fn()) {
  useNewsFeedMock.mockReturnValue({
    // The panel only reads loading/error/value off state.
    state: { loading: false, error: undefined, value: undefined, ...state } as FeedState,
    getNews,
  });
  return getNews;
}

function renderNewsPanel(optionsOverrides?: Partial<Options>, eventBus = new EventBusSrv()) {
  const props = getPanelProps<Options>({ ...defaultOptions, ...optionsOverrides }, { eventBus });
  return render(<NewsPanel {...props} />);
}

describe('NewsPanel', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the error alert when the feed fails to load', () => {
    setFeedState({ error: new Error('boom') });

    renderNewsPanel();

    expect(screen.getByText('Error loading RSS feed')).toBeInTheDocument();
    expect(screen.queryByTestId('news-item')).not.toBeInTheDocument();
  });

  it('renders the loading state while the feed is loading', () => {
    setFeedState({ loading: true });

    renderNewsPanel();

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByTestId('news-item')).not.toBeInTheDocument();
  });

  it('renders nothing when there is no feed value yet', () => {
    setFeedState({ value: undefined });

    const { container } = renderNewsPanel();

    expect(container).toBeEmptyDOMElement();
  });

  it('renders one News item per feed entry on success', () => {
    // The panel calls state.value.map(); DataFrameView is array-like, an array is a valid stand-in.
    setFeedState({ value: [{}, {}, {}] as unknown as FeedState['value'] });

    renderNewsPanel();

    expect(screen.getAllByTestId('news-item')).toHaveLength(3);
  });

  it('fetches news on mount and defaults to the Grafana blog feed', () => {
    const getNews = setFeedState({ value: [] as unknown as FeedState['value'] });

    renderNewsPanel();

    expect(useNewsFeedMock).toHaveBeenCalledWith(DEFAULT_FEED_URL);
    expect(getNews).toHaveBeenCalled();
  });

  it('uses the configured feedUrl when provided', () => {
    setFeedState({ value: [] as unknown as FeedState['value'] });

    renderNewsPanel({ feedUrl: 'https://example.com/rss' });

    expect(useNewsFeedMock).toHaveBeenCalledWith('https://example.com/rss');
  });

  it('subscribes to RefreshEvent on mount and unsubscribes on unmount', () => {
    const getNews = setFeedState({ value: [] as unknown as FeedState['value'] });
    const eventBus = new EventBusSrv();
    const unsubscribe = jest.fn();
    const subscribe = jest.spyOn(eventBus, 'subscribe').mockReturnValue({ unsubscribe });

    const { unmount } = renderNewsPanel(undefined, eventBus);

    expect(subscribe).toHaveBeenCalledWith(RefreshEvent, getNews);

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
