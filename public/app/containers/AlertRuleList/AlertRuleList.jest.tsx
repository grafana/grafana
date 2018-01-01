import React from 'react';
// import renderer from 'react-test-renderer';
import moment from 'moment';
import { AlertRuleList, AlertRuleItem } from './AlertRuleList';
import { RootStore } from 'app/stores/RootStore';
import { backendSrv, createNavTree } from 'test/mocks/common';
import { shallow } from 'enzyme';

describe('AlertRuleList', () => {
  let page, store;

  beforeAll(done => {
    backendSrv.get.mockReturnValue(
      Promise.resolve([
        {
          id: 11,
          dashboardId: 58,
          panelId: 3,
          name: 'Panel Title alert',
          state: 'ok',
          newStateDate: moment()
            .subtract(5, 'minutes')
            .format(),
          evalData: {},
          executionError: '',
          dashboardUri: 'db/mygool',
        },
      ])
    );

    store = RootStore.create(
      {},
      {
        backendSrv: backendSrv,
        navTree: createNavTree('alerting', 'alert-list'),
      }
    );

    page = shallow(<AlertRuleList store={store} />)
      .first()
      .shallow();
    setTimeout(done, 100);
    //page = renderer.create(<AlertRuleList store={store} />);
  });

  it('should call api to get rules', () => {
    expect(backendSrv.get.mock.calls[0][0]).toEqual('/api/alerts');
  });

  it('should render 1 rule', () => {
    console.log(page.find('.card-section').debug());
    expect(page.find(AlertRuleItem)).toHaveLength(1);
  });
});
