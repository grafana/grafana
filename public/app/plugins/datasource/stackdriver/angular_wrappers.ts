import { react2AngularDirective } from 'app/core/utils/react2angular';
import { QueryEditor } from './components/QueryEditor';
// import { MetricPicker } from './components/MetricPicker';
// import { OptionPicker } from './components/OptionPicker';
// import { OptionGroupPicker } from './components/OptionGroupPicker';
// import { AggregationPicker } from './components/AggregationPicker';

export function registerAngularDirectives() {
  //   react2AngularDirective('optionPicker', OptionPicker, [
  //     'options',
  //     'onChange',
  //     'selected',
  //     'searchable',
  //     'className',
  //     'placeholder',
  //   ]);
  //   react2AngularDirective('optionGroupPicker', OptionGroupPicker, [
  //     'groups',
  //     'onChange',
  //     'selected',
  //     'searchable',
  //     'className',
  //     'placeholder',
  //   ]);
  //   react2AngularDirective('metricPicker', MetricPicker, [
  //     'target',
  //     ['onChange', { watchDepth: 'reference' }],
  //     'defaultProject',
  //     'metricType',
  //     ['templateSrv', { watchDepth: 'reference' }],
  //     ['datasource', { watchDepth: 'reference' }],
  //   ]);
  //   react2AngularDirective('aggregationPicker', AggregationPicker, [
  //     'valueType',
  //     'metricKind',
  //     'onChange',
  //     'aggregation',
  //     ['templateSrv', { watchDepth: 'reference' }],
  //   ]);

  react2AngularDirective('queryEditor', QueryEditor, [
    'target',
    'onChange',
    ['uiSegmentSrv', { watchDepth: 'reference' }],
    ['datasource', { watchDepth: 'reference' }],
    ['templateSrv', { watchDepth: 'reference' }],
  ]);
}
