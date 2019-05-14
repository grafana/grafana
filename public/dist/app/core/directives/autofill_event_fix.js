import coreModule from '../core_module';
/** @ngInject */
export function autofillEventFix($compile) {
    return {
        link: function ($scope, elem) {
            var input = elem[0];
            var dispatchChangeEvent = function () {
                var event = new Event('change');
                return input.dispatchEvent(event);
            };
            var onAnimationStart = function (_a) {
                var animationName = _a.animationName;
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
            $scope.$on('$destroy', function () {
                input.removeEventListener('animationstart', onAnimationStart);
                // input.removeEventListener('change', onChange);
            });
        },
    };
}
coreModule.directive('autofillEventFix', autofillEventFix);
//# sourceMappingURL=autofill_event_fix.js.map