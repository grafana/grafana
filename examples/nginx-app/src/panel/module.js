import {PanelCtrl} from  'app/plugins/sdk';

class NginxPanelCtrl extends PanelCtrl {

  constructor($scope, $injector) {
    super($scope, $injector);
  }

}
NginxPanelCtrl.template = '<h2>nginx!</h2>';

export {
  NginxPanelCtrl as PanelCtrl
};

