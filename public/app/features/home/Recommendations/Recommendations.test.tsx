import { act, render, screen, userEvent } from 'test/test-utils';

import Recommendations from './Recommendations';

describe('Recommendations', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('collapses and expands the recommendations card', async () => {
    const { user } = render(<Recommendations />);

    expect(screen.getByText('Recommendations for your stack')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide' }));

    expect(screen.getByRole('button', { name: 'Show' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show' }));

    expect(screen.getByText('Recommendations for your stack')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
  });

  it('loads the collapsed state from local storage', () => {
    window.localStorage.setItem('grafana.home.recommendations.collapsed', 'true');
    render(<Recommendations />);

    expect(screen.getByRole('button', { name: 'Show' })).toBeInTheDocument();
    expect(screen.getByText('Recommendations for your stack')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('navigates recommendations with previous/next buttons', async () => {
    const { user } = render(<Recommendations />);

    const getVisibleHeading = () =>
      screen.getAllByRole('heading', { level: 3 }).find((heading) => heading.closest('div[aria-hidden="false"]'));
    const getVisibleTitle = () => getVisibleHeading()?.textContent?.trim() ?? '';
    const getVisibleSlide = () => getVisibleHeading()?.closest('div[aria-hidden="false"]');

    const initialVisibleSlide = getVisibleSlide();
    const initialVisibleTitle = getVisibleTitle();

    expect(initialVisibleSlide).toBeInTheDocument();
    expect(getVisibleHeading()).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(getVisibleSlide()).toBeInTheDocument();
    expect(getVisibleSlide()).not.toBe(initialVisibleSlide);
    expect(getVisibleTitle()).not.toBe(initialVisibleTitle);
    expect(getVisibleHeading()).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous' }));

    expect(getVisibleSlide()).toBe(initialVisibleSlide);
    expect(getVisibleTitle()).toBe(initialVisibleTitle);
    expect(getVisibleHeading()).toBeInTheDocument();
  });

  it('navigates recommendations with dots', async () => {
    const { user } = render(<Recommendations />);

    expect(screen.queryByRole('button', { name: 'Go to recommendation 1' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to recommendation 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to recommendation 3' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Go to recommendation 3' }));

    expect(screen.getByRole('button', { name: 'Go to recommendation 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to recommendation 2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go to recommendation 3' })).not.toBeInTheDocument();
  });

  it('pauses by default when reduced motion is preferred', () => {
    const matchMediaSpy = jest.spyOn(window, 'matchMedia').mockImplementation(
      () =>
        ({
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          matches: true,
        }) as unknown as MediaQueryList
    );

    try {
      render(<Recommendations />);

      expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
    } finally {
      matchMediaSpy.mockRestore();
    }
  });

  it('pauses and resumes autoplay', async () => {
    jest.useFakeTimers();

    try {
      render(<Recommendations />);
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      const pauseButton = screen.getByRole('button', { name: 'Pause' });
      await user.click(pauseButton);

      expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(6000);
      });

      expect(screen.queryByRole('button', { name: 'Go to recommendation 1' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Resume' }));

      expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(6000);
      });

      expect(screen.getByRole('button', { name: 'Go to recommendation 1' })).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});
