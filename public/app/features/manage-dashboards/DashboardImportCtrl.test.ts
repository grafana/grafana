import { DashboardImportCtrl } from './DashboardImportCtrl';
import config from 'app/core/config';
import { backendSrv } from 'app/core/services/backend_srv';
import { IScope } from 'angular';

describe('DashboardImportCtrl', () => {
  const ctx: any = {};
  jest.spyOn(backendSrv, 'getDashboardByUid').mockImplementation(() => Promise.resolve([]));
  jest.spyOn(backendSrv, 'search').mockImplementation(() => Promise.resolve([]));
  const getMock = jest.spyOn(backendSrv, 'get');
  const $scope = ({ $evalAsync: jest.fn() } as any) as IScope;

  let navModelSrv: any;
  let validationSrv: any;

  beforeEach(() => {
    navModelSrv = {
      getNav: () => {},
    };

    validationSrv = {
      validateNewDashboardName: jest.fn().mockReturnValue(Promise.resolve()),
    };

    ctx.ctrl = new DashboardImportCtrl($scope, validationSrv, navModelSrv, {} as any, {} as any);

    jest.clearAllMocks();
  });

  describe('when uploading json', () => {
    beforeEach(() => {
      config.datasources = {
        ds: {
          type: 'test-db',
        } as any,
      };

      ctx.ctrl.onUpload({
        __inputs: [
          {
            name: 'ds',
            pluginId: 'test-db',
            type: 'datasource',
            pluginName: 'Test DB',
          },
        ],
      });
    });

    it('should build input model', () => {
      expect(ctx.ctrl.inputs.length).toBe(1);
      expect(ctx.ctrl.inputs[0].name).toBe('ds');
      expect(ctx.ctrl.inputs[0].info).toBe('Select a Test DB data source');
    });

    it('should set inputValid to false', () => {
      expect(ctx.ctrl.inputsValid).toBe(false);
    });
  });

  describe('when specifying grafana.com url', () => {
    beforeEach(() => {
      ctx.ctrl.gnetUrl = 'http://grafana.com/dashboards/123';
      // setup api mock
      getMock.mockImplementation(() => Promise.resolve({ json: {} }));
      return ctx.ctrl.checkGnetDashboard();
    });

    it('should call gnet api with correct dashboard id', () => {
      expect(getMock.mock.calls[0][0]).toBe('api/gnet/dashboards/123');
    });
  });

  describe('when specifying dashboard id', () => {
    beforeEach(() => {
      ctx.ctrl.gnetUrl = '2342';
      // setup api mock
      getMock.mockImplementation(() => Promise.resolve({ json: {} }));
      return ctx.ctrl.checkGnetDashboard();
    });

    it('should call gnet api with correct dashboard id', () => {
      expect(getMock.mock.calls[0][0]).toBe('api/gnet/dashboards/2342');
    });
  });
});
