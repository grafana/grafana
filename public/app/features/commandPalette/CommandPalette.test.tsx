import { render, screen } from '@testing-library/react';

import { useAssistant } from '@grafana/assistant';

import { CommandPalette } from './CommandPalette';

// Mock the required hooks and components
jest.mock('./actions/dashboardActions', () => ({
  useSearchResults: jest.fn().mockReturnValue({ searchResults: [], isFetchingSearchResults: false }),
}));

jest.mock('./actions/scopeActions', () => ({
  useRegisterRecentScopesActions: jest.fn(),
  useRegisterScopesActions: jest.fn().mockReturnValue({ scopesRow: null }),
}));

jest.mock('./actions/useActions', () => ({
  useRegisterStaticActions: jest.fn(),
  useRegisterRecentDashboardsActions: jest.fn(),
}));
jest.mock('./useMatches', () => ({
  useMatches: jest.fn().mockReturnValue({
    results: [],
    rootActionId: null,
  }),
}));

jest.mock('./KBarSearch', () => ({
  KBarSearch: jest.fn().mockImplementation(() => <input type="text" />),
}));
jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn(),
  OpenAssistantButton: jest.fn().mockImplementation(({ title }) => <button>{title}</button>),
}));

jest.mock('@grafana/runtime', () => ({
  reportInteraction: jest.fn(),
}));

jest.mock('kbar', () => ({
  KBarPortal: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  KBarPositioner: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  KBarAnimator: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  useKBar: jest.fn().mockReturnValue({
    query: {
      toggle: jest.fn(),
      setSearch: jest.fn(),
      getInput: jest.fn().mockReturnValue({ focus: jest.fn() }),
    },
    searchQuery: 'test search',
    visualState: 'showing',
    search: '', // Add initial search value to prevent uncontrolled to controlled warning
  }),
}));

describe('CommandPalette', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render empty state with AI Assistant button when no results and assistant is available', () => {
    // Mock assistant being available
    (useAssistant as jest.Mock).mockReturnValue({ isAvailable: true });
    render(<CommandPalette />);
    // Check if empty state message is rendered
    expect(screen.getByText('No results found')).toBeInTheDocument();
    // Check if AI Assistant button is rendered with correct props
    expect(screen.getByRole('button', { name: 'Try searching with AI Assistant' })).toBeInTheDocument();
  });

  it('should render empty state without AI Assistant button when assistant is not available', () => {
    // Mock assistant being unavailable
    (useAssistant as jest.Mock).mockReturnValue({ isAvailable: false });
    render(<CommandPalette />);
    // Check if empty state message is rendered
    expect(screen.getByText('No results found')).toBeInTheDocument();
    // Check that AI Assistant button is not rendered
    expect(screen.queryByRole('button', { name: 'Try searching with AI Assistant' })).not.toBeInTheDocument();
  });
});
