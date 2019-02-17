import coreModule from '../core_module';

/** @ngInject */
export function autofillEventFix($compile) {
  return {
    link: ($scope: any, elem: any) => {
      const input = elem[0];
      const dispatchChangeEvent = () => {
        const event = new Event('change');
        return input.dispatchEvent(event);
      };
      const onAnimationStart = ({ animationName }: AnimationEvent) => {
        switch (animationName) {
          case 'onAutoFillStart':
            return dispatchChangeEvent();
          case 'onAutoFillCancel':
            return dispatchChangeEvent();
        }
        return null;
      };

      // const onChange = (evt: Event) => console.log(evt);

      input.addEventListener('animationstart', onAnimationStart);
      // input.addEventListener('change', onChange);

      $scope.$on('$destroy', () => {
        input.removeEventListener('animationstart', onAnimationStart);
        // input.removeEventListener('change', onChange);
      });
    },
  };
}

coreModule.directive('autofillEventFix', autofillEventFix);
