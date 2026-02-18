import { screen } from '@testing-library/react';

import { AlertState } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

import { QueryEditorType } from '../../constants';
import { renderWithQueryEditorProvider } from '../testUtils';
import { AlertRule, EMPTY_ALERT, Transformation } from '../types';

import { SidebarFooter } from './SidebarFooter';

function createAlertRule(overrides: Partial<AlertRule> = {}): AlertRule {
  return { ...EMPTY_ALERT, alertId: `alert-${Math.random()}`, state: AlertState.OK, ...overrides };
}

describe('SidebarFooter', () => {
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
  });

  describe('alert view', () => {
    it('should show alert count and hide visibility indicators', () => {
      const alertRules = [createAlertRule({ alertId: 'a1' }), createAlertRule({ alertId: 'a2' })];

      renderWithQueryEditorProvider(<SidebarFooter />, {
        alertingState: { alertRules },
        uiStateOverrides: { cardType: QueryEditorType.Alert },
      });

      expect(screen.getByText('2 items')).toBeInTheDocument();
      expect(screen.queryByTestId('icon-eye')).not.toBeInTheDocument();
      expect(screen.queryByTestId('icon-eye-slash')).not.toBeInTheDocument();
    });

    it('should show zero items when there are no alerts', () => {
      renderWithQueryEditorProvider(<SidebarFooter />, {
        uiStateOverrides: { cardType: QueryEditorType.Alert },
      });

      expect(screen.getByText('0 items')).toBeInTheDocument();
      expect(screen.queryByTestId('icon-eye')).not.toBeInTheDocument();
      expect(screen.queryByTestId('icon-eye-slash')).not.toBeInTheDocument();
    });
  });
});
