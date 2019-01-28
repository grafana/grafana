import coreModule from 'app/core/core_module';
import { provideConfig } from 'app/core/utils/ConfigProvider';

export function react2AngularDirective(name: string, component: any, options: any) {
  coreModule.directive(name, [
    'reactDirective',
    reactDirective => {
      return reactDirective(provideConfig(component), options);
    },
  ]);
}
