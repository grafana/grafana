import { act, render, screen, userEvent, within } from 'test/test-utils';

import { ContentCarousel, type ContentCarouselProps } from './ContentCarousel';

const ITEMS = ['First', 'Second', 'Third'];

function renderCarousel(props: Partial<ContentCarouselProps<string>> = {}) {
  return render(
    <ContentCarousel
      label="Test slides"
      items={ITEMS}
      getKey={(item) => item}
      renderItem={(item) => <h3>{item}</h3>}
      {...props}
    />
  );
}

function visibleSlide(): string {
  const region = screen.getByRole('region', { name: 'Test slides' });
  return within(region).getByRole('heading', { level: 3 }).textContent ?? '';
}

describe('ContentCarousel', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exposes the carousel and slide semantics', () => {
    renderCarousel();

    expect(screen.getByRole('region', { name: 'Test slides' })).toHaveAttribute('aria-roledescription', 'carousel');
    expect(screen.getByRole('group', { name: '1 of 3' })).toHaveAttribute('aria-roledescription', 'slide');
    // Off-screen slides leave the accessibility tree.
    expect(screen.queryByRole('group', { name: '2 of 3' })).not.toBeInTheDocument();
  });

  it('navigates with previous, next and slide controls, wrapping at both ends', async () => {
    const { user } = renderCarousel();

    expect(visibleSlide()).toBe('First');
    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(visibleSlide()).toBe('Third');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(visibleSlide()).toBe('First');
    await user.click(screen.getByRole('button', { name: 'Go to slide 2' }));
    expect(visibleSlide()).toBe('Second');
    expect(screen.getByRole('button', { name: 'Go to slide 2' })).toHaveAttribute('aria-current', 'true');
  });

  it('labels the slide controls with the given label', () => {
    renderCarousel({ getSlideLabel: (position) => `Show page ${position}` });

    expect(screen.getByRole('button', { name: 'Show page 3' })).toBeInTheDocument();
  });

  it('renders no controls for a single slide', () => {
    renderCarousel({ items: ['Only'], autoAdvanceMs: 1000 });

    expect(visibleSlide()).toBe('Only');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not auto-advance or offer a pause control without an interval', () => {
    jest.useFakeTimers();

    try {
      renderCarousel();
      act(() => jest.advanceTimersByTime(60_000));

      expect(visibleSlide()).toBe('First');
      expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('auto-advances until paused', async () => {
    jest.useFakeTimers();

    try {
      renderCarousel({ autoAdvanceMs: 1000 });
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      act(() => jest.advanceTimersByTime(1000));
      expect(visibleSlide()).toBe('Second');

      await user.click(screen.getByRole('button', { name: 'Pause' }));
      act(() => jest.advanceTimersByTime(5000));
      expect(visibleSlide()).toBe('Second');

      await user.click(screen.getByRole('button', { name: 'Resume' }));
      act(() => jest.advanceTimersByTime(1000));
      expect(visibleSlide()).toBe('Third');
    } finally {
      jest.useRealTimers();
    }
  });

  it('holds while suspended without changing the pause choice', () => {
    jest.useFakeTimers();

    try {
      const { rerender } = renderCarousel({ autoAdvanceMs: 1000, autoAdvanceSuspended: true });
      act(() => jest.advanceTimersByTime(5000));
      expect(visibleSlide()).toBe('First');
      expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();

      rerender(
        <ContentCarousel
          label="Test slides"
          items={ITEMS}
          getKey={(item) => item}
          renderItem={(item) => <h3>{item}</h3>}
          autoAdvanceMs={1000}
        />
      );
      act(() => jest.advanceTimersByTime(1000));
      expect(visibleSlide()).toBe('Second');
    } finally {
      jest.useRealTimers();
    }
  });

  it('starts paused when reduced motion is preferred', () => {
    jest.spyOn(window, 'matchMedia').mockImplementation(
      () =>
        ({
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          matches: true,
        }) as unknown as MediaQueryList
    );

    renderCarousel({ autoAdvanceMs: 1000 });

    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
  });

  it('follows a controlled index and reports changes', async () => {
    const onIndexChange = jest.fn();
    const { user } = renderCarousel({ index: 2, onIndexChange });

    expect(visibleSlide()).toBe('Third');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(onIndexChange).toHaveBeenCalledWith(0);
    // The parent did not apply the change, so the controlled slide stays.
    expect(visibleSlide()).toBe('Third');
  });

  it('clamps an index past the end of a shrinking list', () => {
    renderCarousel({ index: 5 });

    expect(visibleSlide()).toBe('Third');
  });
});
