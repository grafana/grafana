define([
  'app/plugins/sdk'
], function(sdk) {

  var BoilerPlatePanel = (function(_super) {

    function BoilerPlatePanel($scope, $injector) {
      _super.call(this, $scope, $injector);
    }

    // you do not need a templateUrl,  you can use a inline template here
    // BoilerPlatePanel.template = '<h2>boilerplate</h2>';

    // all panel static assets can be accessed via 'public/plugins/<plugin-id>/<file>
    BoilerPlatePanel.templateUrl = 'panel.html';

    BoilerPlatePanel.prototype = Object.create(_super.prototype);
    BoilerPlatePanel.prototype.constructor = BoilerPlatePanel;

    return BoilerPlatePanel;

  })(sdk.PanelCtrl);


  return {
    PanelCtrl: BoilerPlatePanel
  };
});
