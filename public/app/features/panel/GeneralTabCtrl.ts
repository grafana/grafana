import coreModule from 'app/core/core_module';

const obj2string = obj => {
  return Object.keys(obj)
    .reduce((acc, curr) => acc.concat(curr + '=' + obj[curr]), [])
    .join();
};

export class GeneralTabCtrl {
  panelCtrl: any;

  /** @ngInject */
  constructor($scope) {
    this.panelCtrl = $scope.ctrl;

    const updatePanel = () => {
      console.log('panel.render()');
      this.panelCtrl.panel.render();
    };

    const generateValueFromPanel = scope => {
      const { panel } = scope.ctrl;
      const panelPropsToTrack = ['title', 'description', 'transparent', 'repeat', 'repeatDirection', 'minSpan'];
      const panelPropsString = panelPropsToTrack
        .map(prop => prop + '=' + (panel[prop] && panel[prop].toString ? panel[prop].toString() : panel[prop]))
        .join();
      const panelLinks = panel.links || [];
      const panelLinksString = panelLinks.map(obj2string).join();
      return panelPropsString + panelLinksString;
    };

    $scope.$watch(generateValueFromPanel, updatePanel, true);
  }
}

/** @ngInject */
export function generalTab() {
  'use strict';
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/panel/partials/general_tab.html',
    controller: GeneralTabCtrl,
  };
}

coreModule.directive('panelGeneralTab', generalTab);
