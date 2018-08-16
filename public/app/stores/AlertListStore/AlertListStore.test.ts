import { AlertListStore } from './AlertListStore';
import { backendSrv } from 'test/mocks/common';
import moment from 'moment';

function getRule(name, state, info) {
  return {
    id: 11,
    dashboardId: 58,
    panelId: 3,
    name: name,
    state: state,
    newStateDate: moment()
      .subtract(5, 'minutes')
      .format(),
    evalData: {},
    executionError: '',
    url: 'db/mygool',
    stateText: state,
    stateIcon: 'fa',
    stateClass: 'asd',
    stateAge: '10m',
    info: info,
    canEdit: true,
  };
}

describe('AlertListStore', () => {
  let store;

  beforeAll(() => {
    store = AlertListStore.create(
      {
        rules: [
          getRule('Europe', 'OK', 'backend-01'),
          getRule('Google', 'ALERTING', 'backend-02'),
          getRule('Amazon', 'PAUSED', 'backend-03'),
          getRule('West-Europe', 'PAUSED', 'backend-03'),
        ],
        search: '',
      },
      {
        backendSrv: backendSrv,
      }
    );
  });

  it('search should filter list on name', () => {
    store.setSearchQuery('urope');
    expect(store.filteredRules).toHaveLength(2);
  });

  it('search should filter list on state', () => {
    store.setSearchQuery('ale');
    expect(store.filteredRules).toHaveLength(1);
  });

  it('search should filter list on info', () => {
    store.setSearchQuery('-0');
    expect(store.filteredRules).toHaveLength(4);
  });

  it('search should be equal', () => {
    store.setSearchQuery('alert');
    expect(store.search).toBe('alert');
  });
});
