import { react2AngularDirective } from 'app/core/utils/react2angular';
import { QueryEditor as StackdriverQueryEditor } from 'app/plugins/datasource/stackdriver/components/QueryEditor';
import { AnnotationQueryEditor as StackdriverAnnotationQueryEditor } from 'app/plugins/datasource/stackdriver/components/AnnotationQueryEditor';
import { PasswordStrength } from './components/PasswordStrength';
import PageHeader from './components/PageHeader/PageHeader';
import EmptyListCTA from './components/EmptyListCTA/EmptyListCTA';
import { SearchResult } from './components/search/SearchResult';
import { TagFilter } from './components/TagFilter/TagFilter';
import { SideMenu } from './components/sidemenu/SideMenu';
import { MetricSelect } from './components/Select/MetricSelect';
import AppNotificationList from './components/AppNotifications/AppNotificationList';
import { ColorPicker, SeriesColorPickerPopoverWithTheme, SecretFormField } from '@grafana/ui';
import { FunctionEditor } from 'app/plugins/datasource/graphite/FunctionEditor';

export function registerAngularDirectives() {
  react2AngularDirective('passwordStrength', PasswordStrength, ['password']);
  react2AngularDirective('sidemenu', SideMenu, []);
  react2AngularDirective('functionEditor', FunctionEditor, ['func', 'onRemove', 'onMoveLeft', 'onMoveRight']);
  react2AngularDirective('appNotificationsList', AppNotificationList, []);
  react2AngularDirective('pageHeader', PageHeader, ['model', 'noTabs']);
  react2AngularDirective('emptyListCta', EmptyListCTA, ['model']);
  react2AngularDirective('searchResult', SearchResult, []);
  react2AngularDirective('tagFilter', TagFilter, [
    'tags',
    ['onChange', { watchDepth: 'reference' }],
    ['tagOptions', { watchDepth: 'reference' }],
  ]);
  react2AngularDirective('colorPicker', ColorPicker, [
    'color',
    ['onChange', { watchDepth: 'reference', wrapApply: true }],
  ]);
  react2AngularDirective('seriesColorPickerPopover', SeriesColorPickerPopoverWithTheme, [
    'color',
    'series',
    'onColorChange',
    'onToggleAxis',
  ]);
  react2AngularDirective('metricSelect', MetricSelect, [
    'options',
    'onChange',
    'value',
    'isSearchable',
    'className',
    'placeholder',
    ['variables', { watchDepth: 'reference' }],
  ]);
  react2AngularDirective('stackdriverQueryEditor', StackdriverQueryEditor, [
    'target',
    'onQueryChange',
    'onExecuteQuery',
    ['events', { watchDepth: 'reference' }],
    ['datasource', { watchDepth: 'reference' }],
    ['templateSrv', { watchDepth: 'reference' }],
  ]);
  react2AngularDirective('stackdriverAnnotationQueryEditor', StackdriverAnnotationQueryEditor, [
    'target',
    'onQueryChange',
    'onExecuteQuery',
    ['datasource', { watchDepth: 'reference' }],
    ['templateSrv', { watchDepth: 'reference' }],
  ]);
  react2AngularDirective('secretFormField', SecretFormField, [
    'value',
    'isConfigured',
    'inputWidth',
    ['onReset', { watchDepth: 'reference', wrapApply: true }],
    ['onChange', { watchDepth: 'reference', wrapApply: true }],
  ]);
}
