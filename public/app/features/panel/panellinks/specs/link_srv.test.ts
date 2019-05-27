import { LinkSrv } from '../link_srv';
import _ from 'lodash';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { TemplateSrv } from 'app/features/templating/template_srv';
// import { ContextSrvStub } from 'test/specs/helpers';

jest.mock('angular', () => {
  const AngularJSMock = require('test/mocks/angular');
  return new AngularJSMock();
});

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
    timeSrv.setTime({ from: 'now-1', to: 'now' });
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
  });

  describe('built in variables', () => {
    it('should add time range to url if $__urlTimeRange variable present', () => {
      expect(
        linkSrv.getPanelLinkAnchorInfo(
          {
            title: 'Any title',
            url: '/d/1?$__urlTimeRange',
          },
          {}
        ).href
      ).toEqual('/d/1?from=now-1&to=now');
    });

    it('should add all variables to url if $__allVariables variable present', () => {
      expect(
        linkSrv.getPanelLinkAnchorInfo(
          {
            title: 'Any title',
            url: '/d/1?$__allVariables',
          },
          {}
        ).href
      ).toEqual('/d/1?var-test1=val1&var-test2=val2');
    });
  });
});
