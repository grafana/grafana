import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';

import { createTheme, type TimeOption, ThemeContext } from '@grafana/data';

import { TimeRangeOption } from './TimeRangeOption';

const option: TimeOption = { from: 'now-5m', to: 'now', display: 'Last 5 minutes' };

const refreshTheme = { ...createTheme(), flags: { visualDesignRefresh: true } };
const RefreshThemeWrapper = ({ children }: { children: ReactNode }) => (
  <ThemeContext.Provider value={refreshTheme}>{children}</ThemeContext.Provider>
);

describe('TimeRangeOption selected check icon', () => {
  describe('with the visual refresh enabled', () => {
    it('shows a check when selected', () => {
      render(<TimeRangeOption value={option} name="ranges" selected onSelect={jest.fn()} />, {
        wrapper: RefreshThemeWrapper,
      });

      expect(screen.getByText('Last 5 minutes').closest('label')).toContainElement(screen.getByTestId('icon-check'));
    });

    it('shows no check when not selected', () => {
      render(<TimeRangeOption value={option} name="ranges" onSelect={jest.fn()} />, {
        wrapper: RefreshThemeWrapper,
      });

      expect(screen.queryByTestId('icon-check')).not.toBeInTheDocument();
    });
  });

  it('shows no check with the visual refresh disabled', () => {
    render(<TimeRangeOption value={option} name="ranges" selected onSelect={jest.fn()} />);

    expect(screen.queryByTestId('icon-check')).not.toBeInTheDocument();
  });
});
