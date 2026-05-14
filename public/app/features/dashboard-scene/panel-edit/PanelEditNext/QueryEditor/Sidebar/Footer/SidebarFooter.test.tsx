import { screen } from '@testing-library/react';

import { AlertState, type DataSourceInstanceSettings } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { QueryEditorType } from '../../../constants';
import { renderWithQueryEditorProvider } from '../../testUtils';
import { type AlertRule, EMPTY_ALERT, type Transformation } from '../../types';

import { SidebarFooter } from './SidebarFooter';

// The bulk actions bar pulls in DataSourceModal which has a heavy dep tree —
// stub it so SidebarFooter tests stay fast and isolated.
jest.mock('app/features/datasources/components/picker/DataSourceModal', () => ({
  DataSourceModal: ({
    onChange,
    onDismiss,
  }: {
    onChange: (ds: DataSourceInstanceSettings) => void;
    onDismiss: () => void;
  }) => (
    <div data-testid="datasource-modal">
      <button
        onClick={() => onChange({ uid: 'new-ds', type: 'testdata', name: 'New DS' } as DataSourceInstanceSettings)}
      >
        Select DS
      </button>
      <button onClick={onDismiss}>Dismiss DS</button>
    </div>
  ),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const mockReportInteraction = jest.mocked(reportInteraction);

function createAlertRule(overrides: Partial<AlertRule> = {}): AlertRule {
  return { ...EMPTY_ALERT, alertId: `alert-${Math.random()}`, state: AlertState.OK, ...overrides };
}

describe('SidebarFooter', () => {
  beforeAll(() => {
    setTestFlags({ queryEditorNextMultiSelect: true });
  });

  afterAll(() => {
    setTestFlags();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('data view', () => {
    it('should show correct counts when all items are visible', () => {
      const queries: DataQuery[] = [
        { refId: 'A', datasource: { type: 'test', uid: 'test' } },
        { refId: 'B', datasource: { type: 'test', uid: 'test' } },
      ];

      const transformations: Transformation[] = [
        { transformId: 'organize', registryItem: undefined, transformConfig: { id: 'organize', options: {} } },
      ];

      renderWithQueryEditorProvider(<SidebarFooter />, { queries, transformations });

      expect(screen.getByText('3 items')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // visible
      expect(screen.getByText('0')).toBeInTheDocument(); // hidden
    });

    it('should count hidden queries and disabled transformations', () => {
      const queries: DataQuery[] = [
        { refId: 'A', datasource: { type: 'test', uid: 'test' } },
        { refId: 'B', datasource: { type: 'test', uid: 'test' } },
        { refId: 'C', datasource: { type: 'test', uid: 'test' }, hide: true },
      ];

      const transformations: Transformation[] = [
        { transformId: 'organize', registryItem: undefined, transformConfig: { id: 'organize', options: {} } },
        {
          transformId: 'reduce',
          registryItem: undefined,
          transformConfig: { id: 'reduce', options: {}, disabled: true },
        },
      ];

      renderWithQueryEditorProvider(<SidebarFooter />, { queries, transformations });

      expect(screen.getByText('5 items')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // visible
      expect(screen.getByText('2')).toBeInTheDocument(); // hidden
    });

    it('should show zero counts when there are no items', () => {
      renderWithQueryEditorProvider(<SidebarFooter />);

      expect(screen.getByText('0 items')).toBeInTheDocument();
      expect(screen.getAllByText('0')).toHaveLength(2); // both visible and hidden are 0
    });

    it('should show the select button next to the item count', () => {
      renderWithQueryEditorProvider(<SidebarFooter />);

      expect(screen.getByText('0 items')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /select multiple items/i })).toHaveTextContent('Select...');
    });

    it('should enable multi-select mode and track when select is clicked', async () => {
      const setMultiSelectMode = jest.fn();
      const { user } = renderWithQueryEditorProvider(<SidebarFooter />, {
        uiStateOverrides: { setMultiSelectMode },
      });

      await user.click(screen.getByRole('button', { name: /select multiple items/i }));

      expect(setMultiSelectMode).toHaveBeenCalledWith(true);
      expect(mockReportInteraction).toHaveBeenCalledWith('grafana_panel_edit_next_interaction', {
        action: 'click_multi_select',
      });
    });
  });

  describe('bulk actions bar in footer', () => {
    const queries: DataQuery[] = [
      { refId: 'A', datasource: { type: 'test', uid: 'test' } },
      { refId: 'B', datasource: { type: 'test', uid: 'test' } },
    ];
    const transformations: Transformation[] = [
      { transformId: 'tx-0', registryItem: undefined, transformConfig: { id: 'organize', options: {} } },
      { transformId: 'tx-1', registryItem: undefined, transformConfig: { id: 'reduce', options: {} } },
    ];

    it('does not render the bar in the footer when multi-select mode is on but nothing is selected', () => {
      // Multi-select mode without any actionable selection is a degenerate
      // state — the bar deliberately stays hidden.
      renderWithQueryEditorProvider(<SidebarFooter />, {
        queries,
        uiStateOverrides: { selectedQueryRefIds: [], multiSelectMode: true },
      });

      expect(screen.queryByRole('toolbar', { name: /bulk actions/i })).not.toBeInTheDocument();
    });

    it('does not render the bar in the footer when multi-select mode is off and nothing is selected', () => {
      renderWithQueryEditorProvider(<SidebarFooter />, {
        queries,
        uiStateOverrides: { selectedQueryRefIds: [], multiSelectMode: false },
      });

      expect(screen.queryByRole('toolbar', { name: /bulk actions/i })).not.toBeInTheDocument();
    });

    it('renders the bar inside the footer when 2+ queries are selected via keyboard shortcuts (no multi-select mode)', () => {
      renderWithQueryEditorProvider(<SidebarFooter />, {
        queries,
        uiStateOverrides: { selectedQueryRefIds: ['A', 'B'], multiSelectMode: false },
      });

      expect(screen.getByRole('toolbar', { name: /bulk actions/i })).toBeInTheDocument();
    });

    it('does not keep the count layout in the DOM while the bar is shown (a11y)', () => {
      // The bar and the counts render mutually exclusively so the obscured
      // Select… button and item-count text aren't left in the tab order /
      // screen-reader sequence.
      renderWithQueryEditorProvider(<SidebarFooter />, {
        queries,
        uiStateOverrides: { selectedQueryRefIds: ['A', 'B'], multiSelectMode: false },
      });

      expect(screen.getByRole('toolbar', { name: /bulk actions/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /select multiple items/i })).not.toBeInTheDocument();
      expect(screen.queryByText('2 items')).not.toBeInTheDocument();
    });

    it('renders the bar inside the footer when 2+ transformations are selected', () => {
      renderWithQueryEditorProvider(<SidebarFooter />, {
        transformations,
        uiStateOverrides: { selectedTransformationIds: ['tx-0', 'tx-1'], multiSelectMode: true },
      });

      expect(screen.getByRole('toolbar', { name: /bulk actions/i })).toBeInTheDocument();
    });

    it('does not render the bar in the alert view', () => {
      renderWithQueryEditorProvider(<SidebarFooter />, {
        queries,
        uiStateOverrides: {
          selectedQueryRefIds: ['A', 'B'],
          multiSelectMode: true,
          cardType: QueryEditorType.Alert,
        },
      });

      expect(screen.queryByRole('toolbar', { name: /bulk actions/i })).not.toBeInTheDocument();
    });
  });

  describe('with queryEditorNextMultiSelect flag off', () => {
    beforeAll(() => {
      setTestFlags({ queryEditorNextMultiSelect: false });
    });

    afterAll(() => {
      setTestFlags({ queryEditorNextMultiSelect: true });
    });

    it('should hide the select button', () => {
      renderWithQueryEditorProvider(<SidebarFooter />);

      expect(screen.getByText('0 items')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /select multiple items/i })).not.toBeInTheDocument();
    });

    it('still renders the bulk actions bar in the footer when 2+ items are selected via keyboard shortcuts', () => {
      renderWithQueryEditorProvider(<SidebarFooter />, {
        queries: [
          { refId: 'A', datasource: { type: 'test', uid: 'test' } },
          { refId: 'B', datasource: { type: 'test', uid: 'test' } },
        ],
        uiStateOverrides: { selectedQueryRefIds: ['A', 'B'] },
      });

      expect(screen.getByRole('toolbar', { name: /bulk actions/i })).toBeInTheDocument();
    });
  });

  describe('alert view', () => {
    it('should show alert count and hide visibility indicators', () => {
      const alertRules = [createAlertRule({ alertId: 'a1' }), createAlertRule({ alertId: 'a2' })];

      renderWithQueryEditorProvider(<SidebarFooter />, {
        alertingState: { alertRules },
        uiStateOverrides: { cardType: QueryEditorType.Alert },
      });

      expect(screen.getByText('2 alerts')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /select multiple items/i })).not.toBeInTheDocument();
      expect(screen.queryByTestId('icon-eye')).not.toBeInTheDocument();
      expect(screen.queryByTestId('icon-eye-slash')).not.toBeInTheDocument();
    });

    it('should show zero items when there are no alerts', () => {
      renderWithQueryEditorProvider(<SidebarFooter />, {
        uiStateOverrides: { cardType: QueryEditorType.Alert },
      });

      expect(screen.getByText('0 alerts')).toBeInTheDocument();
      expect(screen.queryByTestId('icon-eye')).not.toBeInTheDocument();
      expect(screen.queryByTestId('icon-eye-slash')).not.toBeInTheDocument();
    });
  });
});
