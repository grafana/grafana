define([
  'features/dashboard/dynamicDashboardSrv',
  'features/dashboard/dashboardSrv'
], function() {
  'use strict';

  describe('dynamicDashboardSrv', function() {
    var _dynamicDashboardSrv;
    var _dashboardSrv;

    beforeEach(module('grafana.services'));

    beforeEach(inject(function(dynamicDashboardSrv, dashboardSrv) {
      _dynamicDashboardSrv = dynamicDashboardSrv;
      _dashboardSrv = dashboardSrv;
    }));

    describe('given dashboard with panel repeat', function() {
      var model;

      beforeEach(function() {
        model = _dashboardSrv.create({
          rows: [
            {
              panels: [{id: 2, repeat: '$apps'}]
            }
          ],
          templating: {
            list: [{
              name: 'apps',
              current: {
                text: 'se1, se2',
                value: ['se1', 'se2']
              },
              options: [
                {text: 'se1', value: 'se1', selected: true},
                {text: 'se2', value: 'se2', selected: true},
              ]
            }]
          }
        }, {});

        _dynamicDashboardSrv.init(model);
      });

      it('should repeat panel one time', function() {
        expect(model.rows[0].panels.length).to.be(2);
      });

      it('should mark panel repeated', function() {
        expect(model.rows[0].panels[0].linked).to.be(undefined);
        expect(model.rows[0].panels[0].repeat).to.be('$apps');
        expect(model.rows[0].panels[1].linked).to.be(true);
        expect(model.rows[0].panels[1].repeat).to.be(null);
      });

      it('should set scopedVars on panels', function() {
        expect(model.rows[0].panels[0].scopedVars.apps.value).to.be('se1');
        expect(model.rows[0].panels[1].scopedVars.apps.value).to.be('se2');
      });

    });

  });
});
