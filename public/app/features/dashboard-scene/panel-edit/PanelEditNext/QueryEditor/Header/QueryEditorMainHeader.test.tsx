import { screen } from '@testing-library/react';

import { reportInteraction } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';

import { makeStackedMode, renderWithQueryEditorProvider } from '../testUtils';
import { type Transformation } from '../types';

import { QueryEditorMainHeader } from './QueryEditorMainHeader';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

// The bar has its own tests; here we only care that the header hosts it.
jest.mock('./QueryOptionsBar', () => ({
  QueryOptionsBar: () => <div data-testid="query-options-bar" />,
}));

const mockReportInteraction = jest.mocked(reportInteraction);

const queries: DataQuery[] = [{ refId: 'A' }, { refId: 'B' }];
const transformations: Transformation[] = [
  { transformId: 'organize-0', transformConfig: { id: 'organize', options: {} }, registryItem: undefined },
];

describe('QueryEditorMainHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the total number of queries and transformations', () => {
    renderWithQueryEditorProvider(<QueryEditorMainHeader />, { queries, transformations });

    expect(screen.getByText('Showing 3 items')).toBeInTheDocument();
  });

  it('hosts the query options bar', () => {
    renderWithQueryEditorProvider(<QueryEditorMainHeader />, { queries });

    expect(screen.getByTestId('query-options-bar')).toBeInTheDocument();
  });

  it.each([
    { enabled: true, count: 1 },
    { enabled: false, count: 0 },
  ])('shows $count experimental feedback button(s) when stacked mode enabled is $enabled', ({ enabled, count }) => {
    renderWithQueryEditorProvider(<QueryEditorMainHeader />, {
      uiStateOverrides: { stackedMode: makeStackedMode({ enabled }) },
      actionsOverrides: { onSwitchToClassic: jest.fn() },
    });

    expect(screen.getByRole('button', { name: 'Stacked view' })).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: 'Experimental feature options' })).toHaveLength(count);
  });

  describe('stacked view toggle', () => {
    it('is not pressed when stacked mode is disabled', () => {
      renderWithQueryEditorProvider(<QueryEditorMainHeader />, {
        uiStateOverrides: { stackedMode: makeStackedMode({ enabled: false }) },
      });

      expect(screen.getByRole('button', { name: 'Stacked view' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('is pressed when stacked mode is enabled', () => {
      renderWithQueryEditorProvider(<QueryEditorMainHeader />, {
        uiStateOverrides: { stackedMode: makeStackedMode({ enabled: true }) },
      });

      expect(screen.getByRole('button', { name: 'Stacked view' })).toHaveAttribute('aria-pressed', 'true');
    });

    it.each([
      { enabled: false, tooltip: 'Enter stacked view' },
      { enabled: true, tooltip: 'Exit stacked view' },
    ])('shows "$tooltip" on hover when enabled is $enabled', async ({ enabled, tooltip }) => {
      const { user } = renderWithQueryEditorProvider(<QueryEditorMainHeader />, {
        uiStateOverrides: { stackedMode: makeStackedMode({ enabled }) },
      });

      await user.hover(screen.getByRole('button', { name: 'Stacked view' }));

      expect(await screen.findByText(tooltip)).toBeInTheDocument();
    });

    it('enters stacked mode and tracks it when currently disabled', async () => {
      const enter = jest.fn();
      const { user } = renderWithQueryEditorProvider(<QueryEditorMainHeader />, {
        uiStateOverrides: { stackedMode: makeStackedMode({ enabled: false, enter }) },
      });

      await user.click(screen.getByRole('button', { name: 'Stacked view' }));

      expect(enter).toHaveBeenCalledTimes(1);
      expect(mockReportInteraction).toHaveBeenCalledWith('grafana_panel_edit_next_interaction', {
        action: 'toggle_stacked_view',
        direction: 'enter',
      });
    });

    it('exits stacked mode and tracks it when currently enabled', async () => {
      const exit = jest.fn();
      const { user } = renderWithQueryEditorProvider(<QueryEditorMainHeader />, {
        uiStateOverrides: { stackedMode: makeStackedMode({ enabled: true, exit }) },
      });

      await user.click(screen.getByRole('button', { name: 'Stacked view' }));

      expect(exit).toHaveBeenCalledTimes(1);
      expect(mockReportInteraction).toHaveBeenCalledWith('grafana_panel_edit_next_interaction', {
        action: 'toggle_stacked_view',
        direction: 'exit',
      });
    });
  });
});
