import { AlertRulesState, StoreState } from 'app/types';

import { getSearchQuery, getAlertRuleItems } from './selectors';

describe('Get search query', () => {
  it('should get search query', () => {
    const state: AlertRulesState = { searchQuery: 'dashboard', items: [], isLoading: false };
    const result = getSearchQuery(state);

    expect(result).toEqual(state.searchQuery);
  });
});

describe('Get alert rule items', () => {
  it('should get alert rule items', () => {
    const state = {
      alertRules: {
        items: [
          {
            id: 1,
            dashboardId: 1,
            panelId: 1,
            name: '',
            state: '',
            stateText: '',
            stateIcon: '',
            stateClass: '',
            stateAge: '',
            url: '',
          },
        ],
        searchQuery: '',
      },
    } as unknown as StoreState;

    const result = getAlertRuleItems(state);
    expect(result.length).toEqual(1);
  });

  it('should filter rule items based on search query', () => {
    const state = {
      alertRules: {
        items: [
          {
            id: 1,
            dashboardId: 1,
            panelId: 1,
            name: 'dashboard',
            state: '',
            stateText: '',
            stateIcon: '',
            stateClass: '',
            stateAge: '',
            url: '',
          },
          {
            id: 2,
            dashboardId: 3,
            panelId: 1,
            name: 'dashboard2',
            state: '',
            stateText: '',
            stateIcon: '',
            stateClass: '',
            stateAge: '',
            url: '',
          },
          {
            id: 3,
            dashboardId: 5,
            panelId: 1,
            name: 'hello',
            state: '',
            stateText: '',
            stateIcon: '',
            stateClass: '',
            stateAge: '',
            url: '',
          },
          {
            id: 4,
            dashboardId: 7,
            panelId: 1,
            name: 'test',
            state: '',
            stateText: 'dashboard',
            stateIcon: '',
            stateClass: '',
            stateAge: '',
            url: '',
          },
        ],
        searchQuery: 'dashboard',
      },
    } as unknown as StoreState;

    const result = getAlertRuleItems(state);
    expect(result.length).toEqual(3);
  });
});
