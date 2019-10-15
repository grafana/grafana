import React from 'react';
import { shallow } from 'enzyme';
import { AlertRuleList, Props } from './AlertRuleList';
import { AlertRule } from '../../types';
import appEvents from '../../core/app_events';
import { mockActionCreator } from 'app/core/redux';
import { updateLocation } from 'app/core/actions';
import { NavModel } from '@grafana/data';
import { CoreEvents } from 'app/types';

jest.mock('../../core/app_events', () => ({
  emit: jest.fn(),
}));

const setup = (propOverrides?: object) => {
  const props: Props = {
    navModel: {} as NavModel,
    alertRules: [] as AlertRule[],
    updateLocation: mockActionCreator(updateLocation),
    getAlertRulesAsync: jest.fn(),
    setSearchQuery: jest.fn(),
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

describe('Render', () => {
  it('should render component', () => {
    const { wrapper } = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render alert rules', () => {
    const { wrapper } = setup({
      alertRules: [
        {
          id: 1,
          dashboardId: 7,
          dashboardUid: 'ggHbN42mk',
          dashboardSlug: 'alerting-with-testdata',
          panelId: 3,
          name: 'TestData - Always OK',
          state: 'ok',
          newStateDate: '2018-09-04T10:01:01+02:00',
          evalDate: '0001-01-01T00:00:00Z',
          evalData: {},
          executionError: '',
          url: '/d/ggHbN42mk/alerting-with-testdata',
        },
        {
          id: 3,
          dashboardId: 7,
          dashboardUid: 'ggHbN42mk',
          dashboardSlug: 'alerting-with-testdata',
          panelId: 3,
          name: 'TestData - ok',
          state: 'ok',
          newStateDate: '2018-09-04T10:01:01+02:00',
          evalDate: '0001-01-01T00:00:00Z',
          evalData: {},
          executionError: 'error',
          url: '/d/ggHbN42mk/alerting-with-testdata',
        },
      ],
    });

    expect(wrapper).toMatchSnapshot();
  });
});

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
      const mockEvent = { target: { value: 'alerting' } } as React.ChangeEvent<HTMLSelectElement>;

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
