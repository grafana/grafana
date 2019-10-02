import coreModule from '../core_module';

coreModule.directive('giveFocus', () => {
  return (scope: any, element: any, attrs: any) => {
    element.click((e: any) => {
      e.stopPropagation();
    });

    scope.$watch(
      attrs.giveFocus,
      (newValue: any) => {
        if (!newValue) {
          return;
        }
        setTimeout(() => {
          element.focus();
          const domEl: any = element[0];
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
