import { render, screen } from 'test/test-utils';

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
    expect(screen.getAllByRole('link')).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Show' }));

    expect(screen.getByText('Recommendations for your stack')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('link')).toHaveLength(1);
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

    const getVisibleTitle = () => screen.getByRole('heading', { level: 3 }).textContent?.trim() ?? '';
    const getVisibleSlide = () => screen.getByRole('heading', { level: 3 }).closest('div[aria-hidden="false"]');

    const initialVisibleSlide = getVisibleSlide();
    const initialVisibleTitle = getVisibleTitle();

    expect(initialVisibleSlide).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(getVisibleSlide()).toBeInTheDocument();
    expect(getVisibleSlide()).not.toBe(initialVisibleSlide);
    expect(getVisibleTitle()).not.toBe(initialVisibleTitle);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Previous' }));

    expect(getVisibleSlide()).toBe(initialVisibleSlide);
    expect(getVisibleTitle()).toBe(initialVisibleTitle);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1);
  });
});
