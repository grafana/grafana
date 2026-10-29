import { act, render, screen, within } from 'test/test-utils';

import { ResultTags } from './ResultTags';

describe('ResultTags', () => {
  const tags = ['prod', 'team-a', 'region', 'owner'];
  let availableWidth: number;
  let resize: () => void;
  let observer: ResizeObserver;
  const widths: Record<string, number> = { prod: 40, 'team-a': 60, region: 50, owner: 70 };

  beforeEach(() => {
    availableWidth = 238;
    const rect = document.createElement('div').getBoundingClientRect();
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const width = Array.from(this.children).some((child) => child.tagName === 'UL')
        ? availableWidth
        : (widths[this.textContent ?? ''] ?? 30);
      return { ...rect, width };
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

  it.each([
    {
      desc: 'all tags fit exactly without a count',
      width: 238,
      visible: ['prod', 'team-a', 'region', 'owner'],
      hidden: 0,
    },
    { desc: 'three tags and their count fit exactly', width: 198, visible: ['prod', 'team-a', 'region'], hidden: 1 },
    { desc: 'the count pushes the third tag out', width: 197, visible: ['prod', 'team-a'], hidden: 2 },
    { desc: 'one tag and its count fit exactly', width: 76, visible: ['prod'], hidden: 3 },
    { desc: 'one tag must shrink to leave room for its count', width: 60, visible: ['prod'], hidden: 3 },
  ])('shows the fitting tags when $desc', ({ width, visible, hidden }) => {
    availableWidth = width;
    render(<ResultTags tags={tags} />);

    const list = screen.getByRole('list', { name: 'Tags' });
    for (const tag of visible) {
      expect(within(list).getByText(tag)).toBeInTheDocument();
    }
    expect(within(list).getAllByRole('listitem')).toHaveLength(visible.length + (hidden > 0 ? 1 : 0));
    if (hidden > 0) {
      expect(within(list).getByText(`+${hidden}`)).toBeInTheDocument();
    } else {
      expect(within(list).queryByText(/\+/)).not.toBeInTheDocument();
    }
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

  it.each([
    { width: 91, lastTag: 'tag-1', hidden: 11 },
    { width: 92, lastTag: 'tag-2', hidden: 10 },
  ])('reserves space for a two-digit hidden count at $width pixels', ({ width, lastTag, hidden }) => {
    availableWidth = width;
    const rect = document.createElement('div').getBoundingClientRect();
    jest.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(function () {
      return {
        ...rect,
        width: Array.from(this.children).some((child) => child.tagName === 'UL')
          ? availableWidth
          : this.textContent?.startsWith('+')
            ? 40
            : 20,
      };
    });
    render(<ResultTags tags={Array.from({ length: 12 }, (_, i) => `tag-${i + 1}`)} />);

    const list = screen.getByRole('list', { name: 'Tags' });
    expect(within(list).getByText(lastTag)).toBeInTheDocument();
    expect(within(list).getByText(`+${hidden}`)).toBeInTheDocument();
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
