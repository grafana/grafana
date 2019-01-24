import { getSearchQuery, getAlertRuleItems } from './selectors';

describe('Get search query', () => {
  it('should get search query', () => {
    const state = { searchQuery: 'dashboard' };
    const result = getSearchQuery(state);

    expect(result).toEqual(state.searchQuery);
  });
});

describe('Get alert rule items', () => {
  it('should get alert rule items', () => {
    const state = {
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
    };

    const result = getAlertRuleItems(state);
    expect(result.length).toEqual(1);
  });

  it('should filter rule items based on search query', () => {
    const state = {
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
    };

    const result = getAlertRuleItems(state);
    expect(result.length).toEqual(3);
  });
});
