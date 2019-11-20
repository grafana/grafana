import { LinkSrv } from '../link_srv';
import { DataLinkBuiltInVars } from '@grafana/ui';
import _ from 'lodash';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { advanceTo } from 'jest-date-mock';

jest.mock('angular', () => {
  const AngularJSMock = require('test/mocks/angular');
  return new AngularJSMock();
});

const dataPointMock = {
  seriesName: 'A-series',
  datapoint: [1000000001, 1],
};

describe('linkSrv', () => {
  let linkSrv: LinkSrv;

  function initLinkSrv() {
    const rootScope = {
      $on: jest.fn(),
      onAppEvent: jest.fn(),
      appEvent: jest.fn(),
    };

    const timer = {
      register: jest.fn(),
      cancel: jest.fn(),
      cancelAll: jest.fn(),
    };

    const location = {
      search: jest.fn(() => ({})),
    };

    const _dashboard: any = {
      time: { from: 'now-6h', to: 'now' },
      getTimezone: jest.fn(() => 'browser'),
    };

    const timeSrv = new TimeSrv(rootScope as any, jest.fn() as any, location as any, timer, {} as any);
    timeSrv.init(_dashboard);
    timeSrv.setTime({ from: 'now-1h', to: 'now' });
    _dashboard.refresh = false;

    const _templateSrv = new TemplateSrv();
    _templateSrv.init([
      {
        type: 'query',
        name: 'test1',
        current: { value: 'val1' },
        getValueForUrl: function() {
          return this.current.value;
        },
      },
      {
        type: 'query',
        name: 'test2',
        current: { value: 'val2' },
        getValueForUrl: function() {
          return this.current.value;
        },
      },
    ]);

    linkSrv = new LinkSrv(_templateSrv, timeSrv);
  }

  beforeEach(() => {
    initLinkSrv();
    advanceTo(1000000000);
  });

  describe('built in variables', () => {
    it('should add time range to url if $__url_time_range variable present', () => {
      expect(
        linkSrv.getDataLinkUIModel(
          {
            title: 'Any title',
            url: `/d/1?$${DataLinkBuiltInVars.keepTime}`,
          },
          {},
          {}
        ).href
      ).toEqual('/d/1?from=now-1h&to=now');
    });

    it('should add all variables to url if $__all_variables variable present', () => {
      expect(
        linkSrv.getDataLinkUIModel(
          {
            title: 'Any title',
            url: `/d/1?$${DataLinkBuiltInVars.includeVars}`,
          },
          {},
          {}
        ).href
      ).toEqual('/d/1?var-test1=val1&var-test2=val2');
    });

    it('should interpolate series name', () => {
      expect(
        linkSrv.getDataLinkUIModel(
          {
            title: 'Any title',
            url: `/d/1?var-test=$\{${DataLinkBuiltInVars.seriesName}}`,
          },
          {
            __series: {
              value: {
                name: 'A-series',
              },
              text: 'A-series',
            },
          },
          {}
        ).href
      ).toEqual('/d/1?var-test=A-series');
    });
    it('should interpolate value time', () => {
      expect(
        linkSrv.getDataLinkUIModel(
          {
            title: 'Any title',
            url: `/d/1?time=$\{${DataLinkBuiltInVars.valueTime}}`,
          },
          {
            __value: {
              value: { time: dataPointMock.datapoint[0] },
              text: 'Value',
            },
          },
          {}
        ).href
      ).toEqual('/d/1?time=1000000001');
    });
  });
});
