import coreModule from '../core_module';

coreModule.directive('giveFocus', () => {
  return (scope, element, attrs) => {
    element.click(e => {
      e.stopPropagation();
    });

    scope.$watch(
      attrs.giveFocus,
      newValue => {
        if (!newValue) {
          return;
        }
        setTimeout(() => {
          element.focus();
          const domEl = element[0];
          if (domEl.setSelectionRange) {
            const pos = element.val().length * 2;
            domEl.setSelectionRange(pos, pos);
          }
        }, 200);
      },
      true
    );
  };
});

export default {};
