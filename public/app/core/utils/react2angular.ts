import coreModule from 'app/core/core_module';

export function react2AngularDirective(name: string, component: any, options: any) {
  coreModule.directive(name, [
    'reactDirective',
    reactDirective => {
      return reactDirective(component, options);
    },
  ]);
}
