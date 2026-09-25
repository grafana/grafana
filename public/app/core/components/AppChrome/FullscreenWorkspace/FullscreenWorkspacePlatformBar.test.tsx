import { render, screen, fireEvent } from 'test/test-utils';

import { FullscreenWorkspacePlatformBar } from './FullscreenWorkspacePlatformBar';

describe('FullscreenWorkspacePlatformBar', () => {
  it('renders the menu toggle and breadcrumbs, with the drawer closed initially', () => {
    render(<FullscreenWorkspacePlatformBar />);

    const toggle = screen.getByRole('button', { name: 'Main menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('navigation', { name: 'Breadcrumbs' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Navigation' })).not.toBeInTheDocument();
  });

  it('opens the mega menu drawer when the toggle is clicked', () => {
    render(<FullscreenWorkspacePlatformBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Main menu' }));

    expect(screen.getByRole('navigation', { name: 'Navigation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Main menu' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes the drawer when the toggle is clicked again', () => {
    render(<FullscreenWorkspacePlatformBar />);

    const toggle = screen.getByRole('button', { name: 'Main menu' });
    fireEvent.click(toggle);
    expect(screen.getByRole('navigation', { name: 'Navigation' })).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.queryByRole('navigation', { name: 'Navigation' })).not.toBeInTheDocument();
  });
});
