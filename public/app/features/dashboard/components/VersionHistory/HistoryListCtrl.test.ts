import _ from 'lodash';
import { IScope } from 'angular';

import { HistoryListCtrl } from './HistoryListCtrl';
import { compare, restore, versions } from './__mocks__/history';
import { CoreEvents } from 'app/types';

describe('HistoryListCtrl', () => {
  const RESTORE_ID = 4;

  const versionsResponse: any = versions();

  restore(7, RESTORE_ID);

  let historySrv: any;
  let $rootScope: any;
  const $scope: IScope = ({ $evalAsync: jest.fn() } as any) as IScope;
  let historyListCtrl: any;
  beforeEach(() => {
    historySrv = {
      calculateDiff: jest.fn(),
      restoreDashboard: jest.fn(() => Promise.resolve({})),
    };
    $rootScope = {
      appEvent: jest.fn(),
      onAppEvent: jest.fn(),
    };
  });

  describe('when the history list component is loaded', () => {
    beforeEach(async () => {
      historySrv.getHistoryList = jest.fn(() => Promise.resolve(versionsResponse));
      historyListCtrl = new HistoryListCtrl({}, $rootScope, {} as any, historySrv, $scope);

      historyListCtrl.dashboard = {
        id: 2,
        version: 3,
        formatDate: jest.fn(() => 'date'),
        getRelativeTime: jest.fn(() => 'time ago'),
      };
      historySrv.calculateDiff = jest.fn(() => Promise.resolve(compare('basic')));
      historyListCtrl.delta = {
        basic: '<div></div>',
        json: '',
      };
      historyListCtrl.baseInfo = { version: 1 };
      historyListCtrl.newInfo = { version: 2 };
      historyListCtrl.isNewLatest = false;
    });

    it('should have basic diff state', () => {
      expect(historyListCtrl.delta.basic).toBe('<div></div>');
      expect(historyListCtrl.delta.json).toBe('');
      expect(historyListCtrl.diff).toBe('basic');
    });

    it('should indicate loading has finished', () => {
      expect(historyListCtrl.loading).toBe(false);
    });

    describe('and the json diff is successfully fetched', () => {
      beforeEach(async () => {
        historySrv.calculateDiff = jest.fn(() => Promise.resolve(compare('json')));
        await historyListCtrl.getDiff('json');
      });

      it('should fetch the json diff', () => {
        expect(historySrv.calculateDiff).toHaveBeenCalledTimes(1);
        expect(historyListCtrl.delta.json).toBe('<pre><code></code></pre>');
      });

      it('should set the json diff view as active', () => {
        expect(historyListCtrl.diff).toBe('json');
      });

      it('should indicate loading has finished', () => {
        expect(historyListCtrl.loading).toBe(false);
      });
    });

    describe('and diffs have already been fetched', () => {
      beforeEach(async () => {
        historySrv.calculateDiff = jest.fn(() => Promise.resolve(compare('basic')));
        historyListCtrl.delta.basic = 'cached basic';
        historyListCtrl.getDiff('basic');
        await historySrv.calculateDiff();
      });

      it('should use the cached diffs instead of fetching', () => {
        expect(historySrv.calculateDiff).toHaveBeenCalledTimes(1);
        expect(historyListCtrl.delta.basic).toBe('cached basic');
      });

      it('should indicate loading has finished', () => {
        expect(historyListCtrl.loading).toBe(false);
      });
    });

    describe('and fetching the diff fails', () => {
      beforeEach(async () => {
        historySrv.calculateDiff = jest.fn(() => Promise.reject());
        historyListCtrl.onFetchFail = jest.fn();
        historyListCtrl.delta = {
          basic: '<div></div>',
          json: '',
        };
        await historyListCtrl.getDiff('json');
      });

      it('should call calculateDiff', () => {
        expect(historySrv.calculateDiff).toHaveBeenCalledTimes(1);
      });

      it('should call onFetchFail', () => {
        expect(historyListCtrl.onFetchFail).toBeCalledTimes(1);
      });

      it('should indicate loading has finished', () => {
        expect(historyListCtrl.loading).toBe(false);
      });

      it('should have a default delta/changeset', () => {
        expect(historyListCtrl.delta).toEqual({ basic: '<div></div>', json: '' });
      });
    });
  });

  describe('when the user wants to restore a revision', () => {
    beforeEach(async () => {
      historySrv.getHistoryList = jest.fn(() => Promise.resolve(versionsResponse));
      historySrv.restoreDashboard = jest.fn(() => Promise.resolve());

      historyListCtrl = new HistoryListCtrl({}, $rootScope, {} as any, historySrv, $scope);

      historyListCtrl.dashboard = {
        id: 1,
      };
      historyListCtrl.restore();
      historySrv.restoreDashboard = jest.fn(() => Promise.resolve(versionsResponse));
    });

    it('should display a modal allowing the user to restore or cancel', () => {
      expect($rootScope.appEvent).toHaveBeenCalledTimes(1);
      expect($rootScope.appEvent.mock.calls[0][0]).toBe(CoreEvents.showConfirmModal);
    });

    describe('and restore fails to fetch', () => {
      beforeEach(async () => {
        historySrv.getHistoryList = jest.fn(() => Promise.resolve(versionsResponse));
        historySrv.restoreDashboard = jest.fn(() => Promise.resolve());
        historyListCtrl = new HistoryListCtrl({}, $rootScope, {} as any, historySrv, $scope);
        historySrv.restoreDashboard = jest.fn(() => Promise.reject(new Error('RestoreError')));
        historyListCtrl.restoreConfirm(RESTORE_ID);
      });

      it('should indicate loading has finished', () => {
        expect(historyListCtrl.loading).toBe(false);
      });
    });
  });
});
