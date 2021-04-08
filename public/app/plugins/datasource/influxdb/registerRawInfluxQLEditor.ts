import coreModule from 'app/core/core_module';
import { RawInfluxQLEditor } from './components/RawInfluxQLEditor';

coreModule.directive('rawInfluxEditor', [
  'reactDirective',
  (reactDirective: any) => {
    return reactDirective(RawInfluxQLEditor, ['query', 'onChange', 'onRunQuery']);
  },
]);
