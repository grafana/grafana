define([
  'app/plugins/sdk',
  'lodash',
  './css/styles.css!'
], function(sdk, _) {

  var BoilerPlatePanelCtrl = (function(_super) {
    var self;

    function BoilerPlatePanelCtrl($scope, $injector) {
      _super.call(this, $scope, $injector);

      this.results = []

      self = this;
    }

    // you do not need a templateUrl,  you can use a inline template here
    // BoilerPlatePanelCtrl.template = '<h2>boilerplate</h2>';

    // all panel static assets can be accessed via 'public/plugins/<plugin-id>/<file>
    BoilerPlatePanelCtrl.templateUrl = 'panel.html';

    BoilerPlatePanelCtrl.prototype = Object.create(_super.prototype);
    BoilerPlatePanelCtrl.prototype.constructor = BoilerPlatePanelCtrl;

    BoilerPlatePanelCtrl.prototype.refreshData = function(datasource) {
      this.issueQueries(datasource)
        .then(function(result) {
          self.results = [];
          _.each(result.data, function(target) {
            var last = _.last(target.datapoints)
            self.results.push(last[0]);
          });

          self.render();
        });
    }

    BoilerPlatePanelCtrl.prototype.render = function() {
      this.values = this.results.join(',');
    }

    return BoilerPlatePanelCtrl;

  })(sdk.MetricsPanelCtrl);


  return {
    PanelCtrl: BoilerPlatePanelCtrl
  };
});

