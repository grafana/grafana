import { render, screen, fireEvent } from '@testing-library/react';

import { useGrafana } from 'app/core/context/GrafanaContext';

import { AgentModePlatformBar } from './AgentModePlatformBar';

jest.mock('@grafana/i18n', () => ({
  t: (_: string, fallback: string) => fallback,
}));

jest.mock('app/core/context/GrafanaContext', () => ({
  useGrafana: jest.fn(),
}));

jest.mock('app/types/store', () => ({
  useSelector: jest.fn(() => ({})),
}));

// Breadcrumbs + MegaMenu are exercised by their own tests and pull in Redux/scene
// state, so stub them here to keep this focused on the bar's toggle behaviour.
jest.mock('../../Breadcrumbs/Breadcrumbs', () => ({
  Breadcrumbs: () => <div data-testid="breadcrumbs" />,
}));
jest.mock('../../Breadcrumbs/utils', () => ({
  buildBreadcrumbs: () => [],
}));
jest.mock('../MegaMenu/MegaMenu', () => ({
  MENU_WIDTH: '300px',
  MegaMenu: ({ onClose }: { onClose: () => void }) => (
    <button type="button" data-testid="mega-menu" onClick={onClose}>
      menu
    </button>
  ),
}));

const useGrafanaMock = jest.mocked(useGrafana);

describe('AgentModePlatformBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGrafanaMock.mockReturnValue({
      chrome: { useState: () => ({ sectionNav: { node: {} }, pageNav: undefined }) },
    } as unknown as ReturnType<typeof useGrafana>);
  });

  it('renders the menu toggle and breadcrumbs, with the drawer closed initially', () => {
    render(<AgentModePlatformBar />);

    const toggle = screen.getByRole('button', { name: 'Main menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('breadcrumbs')).toBeInTheDocument();
    expect(screen.queryByTestId('mega-menu')).not.toBeInTheDocument();
  });

  it('opens the mega menu drawer when the toggle is clicked', () => {
    render(<AgentModePlatformBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Main menu' }));

    expect(screen.getByTestId('mega-menu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Main menu' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes the drawer when the mega menu requests close', () => {
    render(<AgentModePlatformBar />);

    fireEvent.click(screen.getByRole('button', { name: 'Main menu' }));
    // The stubbed MegaMenu calls onClose when clicked.
    fireEvent.click(screen.getByTestId('mega-menu'));

    expect(screen.queryByTestId('mega-menu')).not.toBeInTheDocument();
  });
});
