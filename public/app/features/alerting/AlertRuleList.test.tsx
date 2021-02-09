import React from 'react';
import { shallow } from 'enzyme';
import { AlertRuleList, Props } from './AlertRuleList';
import { AlertRule } from '../../types';
import appEvents from '../../core/app_events';
import { NavModel } from '@grafana/data';
import { CoreEvents } from 'app/types';
import { updateLocation } from '../../core/actions';
import { setSearchQuery } from './state/reducers';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';

jest.mock('../../core/app_events', () => ({
  emit: jest.fn(),
}));

const setup = (propOverrides?: object) => {
  const props: Props = {
    navModel: {} as NavModel,
    alertRules: [] as AlertRule[],
    updateLocation: mockToolkitActionCreator(updateLocation),
    getAlertRulesAsync: jest.fn(),
    setSearchQuery: mockToolkitActionCreator(setSearchQuery),
    togglePauseAlertRule: jest.fn(),
    stateFilter: '',
    search: '',
    isLoading: false,
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<AlertRuleList {...props} />);

  return {
    wrapper,
    instance: wrapper.instance() as AlertRuleList,
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

      instance.componentDidUpdate({ stateFilter: 'ok' } as Props);

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
        stateFilter: 'ok',
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

      expect(instance.props.updateLocation).toHaveBeenCalledWith({ query: { state: 'alerting' } });
    });
  });

  describe('Open how to', () => {
    it('should emit show-modal event', () => {
      const { instance } = setup();

      instance.onOpenHowTo();

      expect(appEvents.emit).toHaveBeenCalledWith(CoreEvents.showModal, {
        src: 'public/app/features/alerting/partials/alert_howto.html',
        modalClass: 'confirm-modal',
        model: {},
      });
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
