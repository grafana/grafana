///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import _ from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';
import Drop from 'tether-drop';

/** @ngInject **/
function popoverSrv($compile, $rootScope) {

  this.show = function(options) {
    var popoverScope = _.extend($rootScope.$new(true), options.model);
    var drop;

    function destroyDrop() {
      setTimeout(function() {
        if (drop.tether) {
          drop.destroy();
        }
      });
    }

    popoverScope.dismiss = function() {
      popoverScope.$destroy();
      destroyDrop();
    };

    var contentElement = document.createElement('div');
    contentElement.innerHTML = options.template;

    $compile(contentElement)(popoverScope);

    drop = new Drop({
      target: options.element,
      content: contentElement,
      position: options.position,
      classes: 'drop-popover',
      openOn: options.openOn || 'hover',
      hoverCloseDelay: 200,
      tetherOptions: {
        constraints: [{to: 'window', pin: true, attachment: "both"}]
      }
    });

    drop.on('close', () => {
      popoverScope.dismiss({fromDropClose: true});
      destroyDrop();
      if (options.onClose) {
        options.onClose();
      }
    });

    setTimeout(() => { drop.open(); }, 10);
  };
}

coreModule.service('popoverSrv', popoverSrv);
