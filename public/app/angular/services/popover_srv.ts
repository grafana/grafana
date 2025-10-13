import { extend } from 'lodash';
// @ts-ignore
import Drop from 'tether-drop';

import { GrafanaRootScope } from 'app/angular/GrafanaCtrl';
import coreModule from 'app/angular/core_module';

coreModule.service('popoverSrv', ['$compile', '$rootScope', '$timeout', popoverSrv]);

function popoverSrv(this: any, $compile: any, $rootScope: GrafanaRootScope, $timeout: any) {
  let openDrop: any = null;

  this.close = () => {
    if (openDrop) {
      openDrop.close();
    }
  };

  this.show = (options: any) => {
    if (openDrop) {
      openDrop.close();
      openDrop = null;
    }

    const scope = extend($rootScope.$new(true), options.model);
    let drop: any;

    const cleanUp = () => {
      setTimeout(() => {
        scope.$destroy();

        if (drop.tether) {
          drop.destroy();
        }

        if (options.onClose) {
          options.onClose();
        }
      });

      openDrop = null;
    };

    scope.dismiss = () => {
      drop.close();
    };

    const contentElement = document.createElement('div');
    contentElement.innerHTML = options.template;

    $compile(contentElement)(scope);

    $timeout(() => {
      drop = new Drop({
        target: options.element,
        content: contentElement,
        position: options.position,
        classes: options.classNames || 'drop-popover',
        openOn: options.openOn,
        hoverCloseDelay: 200,
        tetherOptions: {
          constraints: [{ to: 'scrollParent', attachment: 'together' }],
        },
      });

      drop.on('close', () => {
        cleanUp();
      });

      openDrop = drop;
      openDrop.open();
    }, 100);

    // return close function
    return () => {
      if (drop) {
        drop.close();
      }
    };
  };
}
