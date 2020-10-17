import React from 'react';
import { shallow } from 'enzyme';

import { DashNavTimeControls, Props } from './DashNavTimeControls';
import { DashboardModel } from '../../state';
import { LocationState } from 'app/types';
import { dateTime, GrafanaTheme, TimeRange } from '@grafana/data';

const setTimeSpy = jest.fn();

jest.mock('app/features/dashboard/services/TimeSrv', () => ({
  getTimeSrv: jest.fn().mockImplementation(() => ({
    timeRange: jest.fn(),
    getValidIntervals: jest.fn(),
    setTime: setTimeSpy,
  })),
}));

describe('DashNavTimeControls', () => {
  describe('onChangeTimePicker', () => {
    let wrapper: any;

    const props: Props = {
      theme: {} as GrafanaTheme,
      dashboard: new DashboardModel({}),
      location: {} as LocationState,
      onChangeTimeZone: jest.fn(),
    };

    const timeRange: TimeRange = {
      from: dateTime([2019, 1, 11, 12, 0]),
      to: dateTime([2019, 1, 11, 18, 0]),
      raw: {
        from: 'now-6h',
        to: 'now',
      },
    };

    beforeEach(() => {
      jest.clearAllMocks();
      wrapper = shallow(<DashNavTimeControls {...props} />)
        .dive()
        .dive();
    });

    it('should call setTime when no max time limits are set', () => {
      wrapper.instance().onChangeTimePicker(timeRange);
      expect(setTimeSpy).toHaveBeenCalled();
    });

    it('should call setTime when time range does not exceed maxTimeBack or maxTimeSpan', () => {
      const dashboard = new DashboardModel({
        timepicker: {
          maxTimeBack: '6h',
          maxTimeSpan: '6h',
        },
      });
      wrapper.setProps({ dashboard });
      wrapper.instance().onChangeTimePicker(timeRange);
      expect(setTimeSpy).toHaveBeenCalled();
    });

    it('should not call setTime when time range exceeds both maxTimeSpan and maxTimeBack', () => {
      const dashboard = new DashboardModel({
        timepicker: {
          maxTimeBack: '5s',
          maxTimeSpan: '5s',
        },
      });
      wrapper.setProps({ dashboard });
      wrapper.instance().onChangeTimePicker(timeRange);
      expect(setTimeSpy).not.toHaveBeenCalled();
    });

    it('should not call setTime when time range exceeds maxTimeBack', () => {
      const dashboard = new DashboardModel({
        timepicker: {
          maxTimeSpan: '5s',
        },
      });
      wrapper.setProps({ dashboard });
      wrapper.instance().onChangeTimePicker(timeRange);
      expect(setTimeSpy).not.toHaveBeenCalled();
    });

    it('should not call setTime when time range exceeds maxTimeSpan', () => {
      const dashboard = new DashboardModel({
        timepicker: {
          maxTimeBack: '5s',
        },
      });
      wrapper.setProps({ dashboard });
      wrapper.instance().onChangeTimePicker(timeRange);
      expect(setTimeSpy).not.toHaveBeenCalled();
    });

    it('should not call setTime when time range exceeds maxTimeSpan but not maxTimeBack', () => {
      const dashboard = new DashboardModel({
        timepicker: {
          maxTimeBack: '6h',
          maxTimeSpan: '5s',
        },
      });
      wrapper.setProps({ dashboard });
      wrapper.instance().onChangeTimePicker(timeRange);
      expect(setTimeSpy).not.toHaveBeenCalled();
    });

    it('should not call setTime when time range exceeds maxTimeBack but not maxTimeSpan', () => {
      const dashboard = new DashboardModel({
        timepicker: {
          maxTimeBack: '5s',
          maxTimeSpan: '6h',
        },
      });
      wrapper.setProps({ dashboard });
      wrapper.instance().onChangeTimePicker(timeRange);
      expect(setTimeSpy).not.toHaveBeenCalled();
    });
  });
});
