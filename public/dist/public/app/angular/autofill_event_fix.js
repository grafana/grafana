import coreModule from './core_module';
export function autofillEventFix($compile) {
    return {
        link: ($scope, elem) => {
            const input = elem[0];
            const dispatchChangeEvent = () => {
                const event = new Event('change');
                return input.dispatchEvent(event);
            };
            const onAnimationStart = ({ animationName }) => {
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
coreModule.directive('autofillEventFix', ['$compile', autofillEventFix]);
//# sourceMappingURL=autofill_event_fix.js.map