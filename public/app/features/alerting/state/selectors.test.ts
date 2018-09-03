import { getSearchQuery, getAlertRuleItems } from './selectors';
import { AlertRulesState } from '../../../types';

const defaultState: AlertRulesState = {
  items: [],
  searchQuery: '',
};

const getState = (overrides?: object) => Object.assign(defaultState, overrides);

describe('Get search query', () => {
  it('should get search query', () => {
    const state = getState({ searchQuery: 'dashboard' });
    const result = getSearchQuery(state);

    expect(result).toEqual(state.searchQuery);
  });
});

describe('Get alert rule items', () => {
  it('should get alert rule items', () => {
    const state = getState({
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
    });

    const result = getAlertRuleItems(state);

    expect(result.length).toEqual(0);
  });
});
