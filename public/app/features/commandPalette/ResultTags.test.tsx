import { act, render, screen, within } from 'test/test-utils';

import { ResultTags } from './ResultTags';

describe('ResultTags', () => {
  const tags = ['prod', 'team-a', 'region', 'owner'];
  let availableWidth: number;
  let resize: () => void;
  let observer: ResizeObserver;

  beforeEach(() => {
    availableWidth = 238;

    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const width = Array.from(this.children).some((child) => child.tagName === 'UL') ? availableWidth : 40;
      return new DOMRect(0, 0, width, 0);
    });
    observer = { observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn() };
    jest.spyOn(window, 'ResizeObserver').mockImplementation((callback) => {
      resize = () => callback([], observer);
      return observer;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows more than three tags when they fit in the row', () => {
    availableWidth = 400;
    render(<ResultTags tags={['a', 'b', 'c', 'd', 'e']} />);
    const tagList = screen.getByRole('list', { name: 'Tags' });
    expect(within(tagList).getAllByRole('listitem')).toHaveLength(5);
    expect(within(tagList).getByText('e')).toBeInTheDocument();
    expect(within(tagList).queryByText(/\+/)).not.toBeInTheDocument();
  });

  it('recalculates fitting tags when the available width shrinks and grows', () => {
    render(<ResultTags tags={tags} />);
    const list = screen.getByRole('list', { name: 'Tags' });
    expect(within(list).getByText('owner')).toBeInTheDocument();

    availableWidth = 142;
    act(() => resize());
    expect(within(list).getByText('team-a')).toBeInTheDocument();
    expect(within(list).getByText('+2')).toBeInTheDocument();

    availableWidth = 60;
    act(() => resize());
    expect(within(list).getByText('prod')).toBeInTheDocument();
    expect(within(list).getByText('+3')).toBeInTheDocument();

    availableWidth = 238;
    act(() => resize());
    expect(within(list).getByText('owner')).toBeInTheDocument();
    expect(within(list).queryByText(/\+/)).not.toBeInTheDocument();
  });

  it('shows every hidden tag in the count tooltip', async () => {
    availableWidth = 142;
    const { user } = render(<ResultTags tags={tags} />);
    const list = screen.getByRole('list', { name: 'Tags' });
    expect(within(list).getByText('prod')).toBeInTheDocument();
    expect(within(list).queryByText('region')).not.toBeInTheDocument();

    await user.hover(within(list).getByText('+2'));

    const tooltip = await screen.findByRole('tooltip');
    expect(within(tooltip).getByText('region')).toBeInTheDocument();
    expect(within(tooltip).getByText('owner')).toBeInTheDocument();
    expect(within(tooltip).queryByText('prod')).not.toBeInTheDocument();
  });

  it('keeps a single long tag visible without a hidden count', () => {
    availableWidth = 20;
    render(<ResultTags tags={['team-a']} />);
    const list = screen.getByRole('list', { name: 'Tags' });
    expect(within(list).getByText('team-a')).toHaveAttribute('title', 'team-a');
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).queryByText(/\+/)).not.toBeInTheDocument();
  });

  it('remeasures replacement tags in a reused result row', () => {
    availableWidth = 142;
    const { rerender } = render(<ResultTags tags={tags} />);
    expect(within(screen.getByRole('list', { name: 'Tags' })).getByText('+2')).toBeInTheDocument();

    rerender(<ResultTags tags={['region', 'owner']} />);

    const list = screen.getByRole('list', { name: 'Tags' });
    expect(within(list).getByText('region')).toBeInTheDocument();
    expect(within(list).getByText('owner')).toBeInTheDocument();
    expect(within(list).queryByText(/\+/)).not.toBeInTheDocument();
  });

  it('disconnects its resize observer when unmounted', () => {
    const { unmount } = render(<ResultTags tags={tags} />);
    expect(observer.observe).toHaveBeenCalledWith(screen.getByRole('list', { name: 'Tags' }).parentElement);

    unmount();

    expect(observer.disconnect).toHaveBeenCalled();
  });
});
