import _ from 'lodash';
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
      openDrop = null;
    }

    var scope = _.extend($rootScope.$new(true), options.model);
    var drop;

    var cleanUp = () => {
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

    var contentElement = document.createElement('div');
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
    return function() {
      if (drop) {
        drop.close();
      }
    };
  };
}

coreModule.service('popoverSrv', popoverSrv);
