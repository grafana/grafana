import { describe, beforeEach, it, expect, sinon, angularMocks } from 'test/lib/common';
import { Tracker } from 'app/features/dashboard/unsaved_changes_srv';
import 'app/features/dashboard/dashboard_srv';
import { contextSrv } from 'app/core/core';

describe('unsavedChangesSrv', function() {
  var _dashboardSrv;
  var _contextSrvStub = { isEditor: true };
  var _rootScope;
  var _location;
  var _timeout;
  var _window;
  var tracker;
  var dash;
  var scope;

  beforeEach(angularMocks.module('grafana.core'));
  beforeEach(angularMocks.module('grafana.services'));
  beforeEach(
    angularMocks.module(function($provide) {
      $provide.value('contextSrv', _contextSrvStub);
      $provide.value('$window', {});
    })
  );

  beforeEach(
    angularMocks.inject(function($location, $rootScope, dashboardSrv, $timeout, $window) {
      _dashboardSrv = dashboardSrv;
      _rootScope = $rootScope;
      _location = $location;
      _timeout = $timeout;
      _window = $window;
    })
  );

  beforeEach(function() {
    dash = _dashboardSrv.create({
      refresh: false,
      panels: [{ test: 'asd', legend: {} }],
      rows: [
        {
          panels: [{ test: 'asd', legend: {} }],
        },
      ],
    });
    scope = _rootScope.$new();
    scope.appEvent = sinon.spy();
    scope.onAppEvent = sinon.spy();

    tracker = new Tracker(dash, scope, undefined, _location, _window, _timeout, contextSrv, _rootScope);
  });

  it('No changes should not have changes', function() {
    expect(tracker.hasChanges()).to.be(false);
  });

  it('Simple change should be registered', function() {
    dash.property = 'google';
    expect(tracker.hasChanges()).to.be(true);
  });

  it('Should ignore a lot of changes', function() {
    dash.time = { from: '1h' };
    dash.refresh = true;
    dash.schemaVersion = 10;
    expect(tracker.hasChanges()).to.be(false);
  });

  it.skip('Should ignore row collapse change', function() {
    dash.rows[0].collapse = true;
    expect(tracker.hasChanges()).to.be(false);
  });

  it('Should ignore panel legend changes', function() {
    dash.panels[0].legend.sortDesc = true;
    dash.panels[0].legend.sort = 'avg';
    expect(tracker.hasChanges()).to.be(false);
  });

  it.skip('Should ignore panel repeats', function() {
    dash.rows[0].panels.push({ repeatPanelId: 10 });
    expect(tracker.hasChanges()).to.be(false);
  });

  it.skip('Should ignore row repeats', function() {
    dash.addEmptyRow();
    dash.rows[1].repeatRowId = 10;
    expect(tracker.hasChanges()).to.be(false);
  });
});
