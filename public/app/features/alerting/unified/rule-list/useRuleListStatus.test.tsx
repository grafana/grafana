import { renderHook } from '@testing-library/react';
import { type PropsWithChildren } from 'react';
import { Provider } from 'react-redux';

import { type RulesSourceDataSource } from '@grafana/alerting/internal';
import { AccessControlAction } from 'app/types/accessControl';
import { type StoreState } from 'app/types/store';

import { type DataSourcesForRulesResult } from '../hooks/useDataSourcesForRules';
import { grantUserPermissions, mockDataSource } from '../mocks';
import { mockUnifiedAlertingStore } from '../testSetup/mockUnifiedAlertingStore';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { useRuleListStatus } from './useRuleListStatus';

const mimir = mockDataSource({ uid: 'mimir', name: 'mimir', type: 'prometheus' });
const mimirRulesSource: RulesSourceDataSource = {
  uid: mimir.uid,
  type: 'prometheus',
  name: mimir.name,
  meta: mimir.meta,
  managesAlerts: true,
  allowedAsRecordingRuleTarget: true,
};

const loadedList: DataSourcesForRulesResult = { items: [mimirRulesSource], isLoading: false };

const noPromRules = { loading: false, dispatched: true, result: [] };
const noRulerRules = { loading: false, dispatched: true, result: {} };

type UnifiedAlertingState = Partial<StoreState['unifiedAlerting']>;

function getRuleListStatus(rulesSources: DataSourcesForRulesResult, state: UnifiedAlertingState) {
  const store = mockUnifiedAlertingStore(state);
  const wrapper = ({ children }: PropsWithChildren) => <Provider store={store}>{children}</Provider>;

  return renderHook(() => useRuleListStatus(rulesSources), { wrapper }).result.current;
}

describe('useRuleListStatus', () => {
  beforeEach(() => {
    grantUserPermissions([AccessControlAction.AlertingRuleRead, AccessControlAction.AlertingRuleExternalRead]);
  });

  it('reports no rules when every rules source answered without rules', () => {
    const status = getRuleListStatus(loadedList, {
      promRules: { [GRAFANA_RULES_SOURCE_NAME]: noPromRules, mimir: noPromRules },
      rulerRules: { [GRAFANA_RULES_SOURCE_NAME]: noRulerRules },
    });

    expect(status.hasNoRules).toBe(true);
  });

  it('does not report no rules while a data source has no rules request yet', () => {
    const status = getRuleListStatus(loadedList, {
      promRules: { [GRAFANA_RULES_SOURCE_NAME]: noPromRules },
      rulerRules: { [GRAFANA_RULES_SOURCE_NAME]: noRulerRules },
    });

    expect(status.hasNoRules).toBe(false);
  });

  it('does not report no rules when the rules source list fails to load', () => {
    const status = getRuleListStatus(
      { items: [], isLoading: false, error: new Error('Failed to fetch') },
      {
        promRules: { [GRAFANA_RULES_SOURCE_NAME]: noPromRules },
        rulerRules: { [GRAFANA_RULES_SOURCE_NAME]: noRulerRules },
      }
    );

    expect(status.hasNoRules).toBe(false);
  });

  it('reports no rules without a Grafana-managed request when the user cannot view Grafana-managed rules', () => {
    grantUserPermissions([AccessControlAction.AlertingRuleExternalRead]);

    const status = getRuleListStatus(loadedList, { promRules: { mimir: noPromRules } });

    expect(status.hasNoRules).toBe(true);
  });

  it('counts a failed ruler request as no rules', () => {
    const status = getRuleListStatus(loadedList, {
      promRules: { [GRAFANA_RULES_SOURCE_NAME]: noPromRules, mimir: noPromRules },
      rulerRules: {
        [GRAFANA_RULES_SOURCE_NAME]: noRulerRules,
        mimir: { loading: false, dispatched: true, error: { message: 'ruler not supported' } },
      },
    });

    expect(status.hasNoRules).toBe(true);
  });

  it('reports loading while the rules source list loads', () => {
    const status = getRuleListStatus({ items: [], isLoading: true }, {});

    expect(status.isLoading).toBe(true);
    expect(status.hasNoRules).toBe(false);
  });
});
