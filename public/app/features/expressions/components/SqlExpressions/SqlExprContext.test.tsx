import { render, screen } from 'test/test-utils';

import { SqlExprContextValue, SqlExprProvider, useSqlExprContext } from './SqlExprContext';

describe('SqlExprContext', () => {
  const mockContextValue: SqlExprContextValue = {
    explanation: 'Test explanation',
    isExplanationOpen: false,
    shouldShowViewExplanation: false,
    handleExplain: jest.fn(),
    handleOpenExplanation: jest.fn(),
    handleCloseExplanation: jest.fn(),
    suggestions: ['suggestion1', 'suggestion2'],
    isDrawerOpen: false,
    handleHistoryUpdate: jest.fn(),
    handleApplySuggestion: jest.fn(),
    handleOpenDrawer: jest.fn(),
    handleCloseDrawer: jest.fn(),
  };

  describe('SqlExprProvider', () => {
    it('renders children correctly', () => {
      render(
        <SqlExprProvider value={mockContextValue}>
          <div>Test Child</div>
        </SqlExprProvider>
      );

      expect(screen.getByText('Test Child')).toBeInTheDocument();
    });

    it('provides context value to children', () => {
      const TestConsumer = () => {
        const context = useSqlExprContext();
        return <div>{context.explanation}</div>;
      };

      render(
        <SqlExprProvider value={mockContextValue}>
          <TestConsumer />
        </SqlExprProvider>
      );

      expect(screen.getByText('Test explanation')).toBeInTheDocument();
    });
  });

  describe('useSqlExprContext', () => {
    it('throws error when used outside provider', () => {
      const TestComponent = () => {
        useSqlExprContext();
        return <div>Should not render</div>;
      };

      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useSqlExprContext must be used within SqlExprProvider');

      consoleSpy.mockRestore();
    });

    it('returns context value when used inside provider', () => {
      const TestComponent = () => {
        const context = useSqlExprContext();
        return (
          <div>
            <span>Explanation: {context.explanation}</span>
            <span>Suggestions: {context.suggestions.length}</span>
            <span>Is Drawer Open: {context.isDrawerOpen.toString()}</span>
          </div>
        );
      };

      render(
        <SqlExprProvider value={mockContextValue}>
          <TestComponent />
        </SqlExprProvider>
      );

      expect(screen.getByText('Explanation: Test explanation')).toBeInTheDocument();
      expect(screen.getByText('Suggestions: 2')).toBeInTheDocument();
      expect(screen.getByText('Is Drawer Open: false')).toBeInTheDocument();
    });
  });
});
