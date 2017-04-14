///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import _ from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';
import Drop from 'tether-drop';

/** @ngInject **/
function popoverSrv($compile, $rootScope, $timeout) {
  let openDrop = null;

  this.close = function() {
    if (openDrop) {
      openDrop.close();
    }
  };

  this.show = function(options) {
    if (openDrop) {
      openDrop.close();
    }

    var scope = _.extend($rootScope.$new(true), options.model);
    var drop;

    var cleanUp = () => {
      setTimeout(() => {
        scope.$destroy();
        drop.destroy();

        if (options.onClose) {
          options.onClose();
        }
      });
    };

    scope.dismiss = () => {
      drop.close();
    };

    var contentElement = document.createElement('div');
    contentElement.innerHTML = options.template;

    $compile(contentElement)(scope);

    drop = new Drop({
      target: options.element,
      content: contentElement,
      position: options.position,
      classes: options.classNames || 'drop-popover',
      openOn: options.openOn,
      hoverCloseDelay: 200,
      tetherOptions: {
        constraints: [{to: 'scrollParent', attachment: "none both"}]
      }
    });

    drop.on('close', () => {
      cleanUp();
    });

    openDrop = drop;
    $timeout(() => { drop.open(); }, 10);
  };
}

coreModule.service('popoverSrv', popoverSrv);
