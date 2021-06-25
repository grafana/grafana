import React from 'react';
import { shallow } from 'enzyme';
import { AlertRuleListUnconnected, Props } from './AlertRuleList';
import { AlertRule } from '../../types';
import appEvents from '../../core/app_events';
import { NavModel } from '@grafana/data';
import { setSearchQuery } from './state/reducers';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { locationService } from '@grafana/runtime';
import { ShowModalReactEvent } from '../../types/events';
import { AlertHowToModal } from './AlertHowToModal';

jest.mock('../../core/app_events', () => ({
  publish: jest.fn(),
}));

const setup = (propOverrides?: object) => {
  const props: Props = {
    ...getRouteComponentProps({}),
    navModel: {} as NavModel,
    alertRules: [] as AlertRule[],
    getAlertRulesAsync: jest.fn(),
    setSearchQuery: mockToolkitActionCreator(setSearchQuery),
    togglePauseAlertRule: jest.fn(),
    search: '',
    isLoading: false,
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<AlertRuleListUnconnected {...props} />);

  return {
    wrapper,
    instance: wrapper.instance() as AlertRuleListUnconnected,
  };
};

describe('Life cycle', () => {
  describe('component did mount', () => {
    it('should call fetchrules', () => {
      const { instance } = setup();
      instance.fetchRules = jest.fn();
      instance.componentDidMount();
      expect(instance.fetchRules).toHaveBeenCalled();
    });
  });

  describe('component did update', () => {
    it('should call fetchrules if props differ', () => {
      const { instance } = setup();
      instance.fetchRules = jest.fn();

      instance.componentDidUpdate({ queryParams: { state: 'ok' } } as any);

      expect(instance.fetchRules).toHaveBeenCalled();
    });
  });
});

describe('Functions', () => {
  describe('Get state filter', () => {
    it('should get all if prop is not set', () => {
      const { instance } = setup();
      const stateFilter = instance.getStateFilter();
      expect(stateFilter).toEqual('all');
    });

    it('should return state filter if set', () => {
      const { instance } = setup({
        queryParams: { state: 'ok' },
      });

      const stateFilter = instance.getStateFilter();
      expect(stateFilter).toEqual('ok');
    });
  });

  describe('State filter changed', () => {
    it('should update location', () => {
      const { instance } = setup();
      const mockEvent = { value: 'alerting' };
      instance.onStateFilterChanged(mockEvent);
      expect(locationService.getSearchObject().state).toBe('alerting');
    });
  });

  describe('Open how to', () => {
    it('should emit show-modal event', () => {
      const { instance } = setup();

      instance.onOpenHowTo();

      expect(appEvents.publish).toHaveBeenCalledWith(new ShowModalReactEvent({ component: AlertHowToModal }));
    });
  });

  describe('Search query change', () => {
    it('should set search query', () => {
      const { instance } = setup();
      instance.onSearchQueryChange('dashboard');
      expect(instance.props.setSearchQuery).toHaveBeenCalledWith('dashboard');
    });
  });
});
