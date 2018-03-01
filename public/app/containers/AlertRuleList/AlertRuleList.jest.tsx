import React from 'react';
import moment from 'moment';
import { AlertRuleList } from './AlertRuleList';
import { RootStore } from 'app/stores/RootStore/RootStore';
import { backendSrv, createNavTree } from 'test/mocks/common';
import { mount } from 'enzyme';
import toJson from 'enzyme-to-json';

describe('AlertRuleList', () => {
  let page, store;

  beforeAll(() => {
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
          url: 'd/ufkcofof/my-goal',
          canEdit: true,
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

    page = mount(<AlertRuleList {...store} />);
  });

  it('should call api to get rules', () => {
    expect(backendSrv.get.mock.calls[0][0]).toEqual('/api/alerts');
  });

  it('should render 1 rule', () => {
    page.update();
    let ruleNode = page.find('.alert-rule-item');
    expect(toJson(ruleNode)).toMatchSnapshot();
  });

  it('toggle state should change pause rule if not paused', async () => {
    backendSrv.post.mockReturnValue(
      Promise.resolve({
        state: 'paused',
      })
    );

    page.find('.fa-pause').simulate('click');

    // wait for api call to resolve
    await Promise.resolve();
    page.update();

    expect(store.alertList.rules[0].state).toBe('paused');
    expect(page.find('.fa-play')).toHaveLength(1);
  });
});
