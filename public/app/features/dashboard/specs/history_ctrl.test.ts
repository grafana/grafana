import _ from 'lodash';
import { HistoryListCtrl } from 'app/features/dashboard/history/history';
import { versions, compare, restore } from './history_mocks';
import $q from 'q';

describe('HistoryListCtrl', () => {
  const RESTORE_ID = 4;

  const versionsResponse: any = versions();

  restore(7, RESTORE_ID);

  let historySrv;
  let $rootScope;
  let historyListCtrl;
  beforeEach(() => {
    historySrv = {
      calculateDiff: jest.fn(),
      restoreDashboard: jest.fn(() => $q.when({})),
    };
    $rootScope = {
      appEvent: jest.fn(),
      onAppEvent: jest.fn(),
    };
  });

  describe('when the history list component is loaded', () => {
    let deferred;

    beforeEach(() => {
      deferred = $q.defer({});
      historySrv.getHistoryList = jest.fn(() => deferred.promise);

      historyListCtrl = new HistoryListCtrl({}, $rootScope, {}, $q, historySrv, {});

      historyListCtrl.dashboard = {
        id: 2,
        version: 3,
        formatDate: jest.fn(() => 'date'),
      };
    });

    it('should immediately attempt to fetch the history list', () => {
      expect(historySrv.getHistoryList).toHaveBeenCalledTimes(1);
    });

    describe('and the history list is successfully fetched', () => {
      beforeEach(async () => {
        deferred.resolve(versionsResponse);
        await historyListCtrl.getLog();
      });

      it("should reset the controller's state", async () => {
        expect(historyListCtrl.mode).toBe('list');
        expect(historyListCtrl.delta).toEqual({ basic: '', json: '' });

        expect(historyListCtrl.canCompare).toBe(false);
        expect(_.find(historyListCtrl.revisions, rev => rev.checked)).toBe(undefined);
      });

      it('should indicate loading has finished', () => {
        expect(historyListCtrl.loading).toBe(false);
      });

      it('should store the revisions sorted desc by version id', () => {
        expect(historyListCtrl.revisions[0].version).toBe(4);
        expect(historyListCtrl.revisions[1].version).toBe(3);
        expect(historyListCtrl.revisions[2].version).toBe(2);
        expect(historyListCtrl.revisions[3].version).toBe(1);
      });

      it('should add a checked property to each revision', () => {
        const actual = _.filter(historyListCtrl.revisions, rev => rev.hasOwnProperty('checked'));
        expect(actual.length).toBe(4);
      });

      it('should set all checked properties to false on reset', () => {
        historyListCtrl.revisions[0].checked = true;
        historyListCtrl.revisions[2].checked = true;
        historyListCtrl.reset();
        const actual = _.filter(historyListCtrl.revisions, rev => !rev.checked);
        expect(actual.length).toBe(4);
      });
    });

    describe('and fetching the history list fails', () => {
      beforeEach(async () => {
        deferred = $q.defer();

        historySrv.getHistoryList = jest.fn(() => deferred.promise);

        historyListCtrl = new HistoryListCtrl({}, $rootScope, {}, $q, historySrv, {});

        deferred.reject(new Error('HistoryListError'));

        await historyListCtrl.getLog();
      });

      it("should reset the controller's state", () => {
        expect(historyListCtrl.mode).toBe('list');
        expect(historyListCtrl.delta).toEqual({ basic: '', json: '' });
        expect(_.find(historyListCtrl.revisions, rev => rev.checked)).toBe(undefined);
      });

      it('should indicate loading has finished', () => {
        expect(historyListCtrl.loading).toBe(false);
      });

      it('should have an empty revisions list', () => {
        expect(historyListCtrl.revisions).toEqual([]);
      });
    });

    describe('should update the history list when the dashboard is saved', () => {
      beforeEach(() => {
        historyListCtrl.dashboard = { version: 3 };
        historyListCtrl.resetFromSource = jest.fn();
      });

      it('should listen for the `dashboard-saved` appEvent', () => {
        expect($rootScope.onAppEvent).toHaveBeenCalledTimes(1);
        expect($rootScope.onAppEvent.mock.calls[0][0]).toBe('dashboard-saved');
      });

      it('should call `onDashboardSaved` when the appEvent is received', () => {
        expect($rootScope.onAppEvent.mock.calls[0][1]).not.toBe(historyListCtrl.onDashboardSaved);
        expect($rootScope.onAppEvent.mock.calls[0][1].toString).toBe(historyListCtrl.onDashboardSaved.toString);
      });
    });
  });

  describe('when the user wants to compare two revisions', () => {
    let deferred;

    beforeEach(async () => {
      deferred = $q.defer({});
      historySrv.getHistoryList = jest.fn(() => $q.when(versionsResponse));
      historySrv.calculateDiff = jest.fn(() => deferred.promise);

      historyListCtrl = new HistoryListCtrl({}, $rootScope, {}, $q, historySrv, {});

      historyListCtrl.dashboard = {
        id: 2,
        version: 3,
        formatDate: jest.fn(() => 'date'),
      };

      deferred.resolve(versionsResponse);
      await historyListCtrl.getLog();
    });

    it('should have already fetched the history list', () => {
      expect(historySrv.getHistoryList).toHaveBeenCalled();
      expect(historyListCtrl.revisions.length).toBeGreaterThan(0);
    });

    it('should check that two valid versions are selected', () => {
      // []
      expect(historyListCtrl.canCompare).toBe(false);

      // single value
      historyListCtrl.revisions = [{ checked: true }];
      historyListCtrl.revisionSelectionChanged();
      expect(historyListCtrl.canCompare).toBe(false);

      // both values in range
      historyListCtrl.revisions = [{ checked: true }, { checked: true }];
      historyListCtrl.revisionSelectionChanged();
      expect(historyListCtrl.canCompare).toBe(true);
    });

    describe('and the basic diff is successfully fetched', () => {
      beforeEach(async () => {
        deferred = $q.defer({});
        historySrv.calculateDiff = jest.fn(() => deferred.promise);
        deferred.resolve(compare('basic'));
        historyListCtrl.revisions[1].checked = true;
        historyListCtrl.revisions[3].checked = true;
        await historyListCtrl.getDiff('basic');
      });

      it('should fetch the basic diff if two valid versions are selected', () => {
        expect(historySrv.calculateDiff).toHaveBeenCalledTimes(1);
        expect(historyListCtrl.delta.basic).toBe('<div></div>');
        expect(historyListCtrl.delta.json).toBe('');
      });

      it('should set the basic diff view as active', () => {
        expect(historyListCtrl.mode).toBe('compare');
        expect(historyListCtrl.diff).toBe('basic');
      });

      it('should indicate loading has finished', () => {
        expect(historyListCtrl.loading).toBe(false);
      });
    });

    describe('and the json diff is successfully fetched', () => {
      beforeEach(async () => {
        deferred = $q.defer({});
        historySrv.calculateDiff = jest.fn(() => deferred.promise);
        deferred.resolve(compare('json'));
        historyListCtrl.revisions[1].checked = true;
        historyListCtrl.revisions[3].checked = true;
        await historyListCtrl.getDiff('json');
      });

      it('should fetch the json diff if two valid versions are selected', () => {
        expect(historySrv.calculateDiff).toHaveBeenCalledTimes(1);
        expect(historyListCtrl.delta.basic).toBe('');
        expect(historyListCtrl.delta.json).toBe('<pre><code></code></pre>');
      });

      it('should set the json diff view as active', () => {
        expect(historyListCtrl.mode).toBe('compare');
        expect(historyListCtrl.diff).toBe('json');
      });

      it('should indicate loading has finished', () => {
        expect(historyListCtrl.loading).toBe(false);
      });
    });

    describe('and diffs have already been fetched', () => {
      beforeEach(async () => {
        deferred.resolve(compare('basic'));

        historyListCtrl.revisions[3].checked = true;
        historyListCtrl.revisions[1].checked = true;
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
        deferred = $q.defer({});
        historySrv.calculateDiff = jest.fn(() => deferred.promise);

        historyListCtrl.revisions[3].checked = true;
        historyListCtrl.revisions[1].checked = true;
        deferred.reject();
        await historyListCtrl.getDiff('basic');
      });

      it('should fetch the diff if two valid versions are selected', () => {
        expect(historySrv.calculateDiff).toHaveBeenCalledTimes(1);
      });

      it('should return to the history list view', () => {
        expect(historyListCtrl.mode).toBe('list');
      });

      it('should indicate loading has finished', () => {
        expect(historyListCtrl.loading).toBe(false);
      });

      it('should have an empty delta/changeset', () => {
        expect(historyListCtrl.delta).toEqual({ basic: '', json: '' });
      });
    });
  });

  describe('when the user wants to restore a revision', () => {
    let deferred;

    beforeEach(async () => {
      deferred = $q.defer();
      historySrv.getHistoryList = jest.fn(() => $q.when(versionsResponse));
      historySrv.restoreDashboard = jest.fn(() => deferred.promise);

      historyListCtrl = new HistoryListCtrl({}, $rootScope, {}, $q, historySrv, {});

      historyListCtrl.dashboard = {
        id: 1,
      };
      historyListCtrl.restore();
      deferred.resolve(versionsResponse);
      await historyListCtrl.getLog();
    });

    it('should display a modal allowing the user to restore or cancel', () => {
      expect($rootScope.appEvent).toHaveBeenCalledTimes(1);
      expect($rootScope.appEvent.mock.calls[0][0]).toBe('confirm-modal');
    });

    describe('and restore fails to fetch', () => {
      beforeEach(async () => {
        deferred = $q.defer();
        historySrv.getHistoryList = jest.fn(() => $q.when(versionsResponse));
        historySrv.restoreDashboard = jest.fn(() => deferred.promise);
        historyListCtrl = new HistoryListCtrl({}, $rootScope, {}, $q, historySrv, {});
        deferred.reject(new Error('RestoreError'));
        historyListCtrl.restoreConfirm(RESTORE_ID);
        await historyListCtrl.getLog();
      });

      it('should indicate loading has finished', () => {
        expect(historyListCtrl.loading).toBe(false);
      });
    });
  });
});
