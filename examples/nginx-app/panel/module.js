define([
  'app/plugins/sdk'
], function(sdk) {
  'use strict';

  var NginxPanel = (function(_super) {
    function NginxPanel($scope, $injector) {
      _super.call(this, $scope, $injector);
    }

    NginxPanel.template = '<h2>nginx!</h2>';
    NginxPanel.prototype = Object.create(_super.prototype);
    NginxPanel.prototype.constructor = NginxPanel;

    return NginxPanel;
  })(sdk.PanelCtrl);

  return {
    PanelCtrl: NginxPanel
  };
});
