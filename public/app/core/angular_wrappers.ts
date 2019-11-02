import { react2AngularDirective } from 'app/core/utils/react2angular';
import { QueryEditor as StackdriverQueryEditor } from 'app/plugins/datasource/stackdriver/components/QueryEditor';
import { AnnotationQueryEditor as StackdriverAnnotationQueryEditor } from 'app/plugins/datasource/stackdriver/components/AnnotationQueryEditor';
import PageHeader from './components/PageHeader/PageHeader';
import EmptyListCTA from './components/EmptyListCTA/EmptyListCTA';
import { TagFilter } from './components/TagFilter/TagFilter';
import { SideMenu } from './components/sidemenu/SideMenu';
import { MetricSelect } from './components/Select/MetricSelect';
import AppNotificationList from './components/AppNotifications/AppNotificationList';
import {
  ColorPicker,
  SeriesColorPickerPopoverWithTheme,
  SecretFormField,
  DataLinksEditor,
  DataSourceHttpSettings,
} from '@grafana/ui';
import { FunctionEditor } from 'app/plugins/datasource/graphite/FunctionEditor';
import { SearchField } from './components/search/SearchField';
import { GraphContextMenu } from 'app/plugins/panel/graph/GraphContextMenu';
import ReactProfileWrapper from 'app/features/profile/ReactProfileWrapper';
import { LokiAnnotationsQueryEditor } from '../plugins/datasource/loki/components/AnnotationsQueryEditor';
import { HelpModal } from './components/help/HelpModal';

export function registerAngularDirectives() {
  react2AngularDirective('helpModal', HelpModal, []);
  react2AngularDirective('sidemenu', SideMenu, []);
  react2AngularDirective('functionEditor', FunctionEditor, ['func', 'onRemove', 'onMoveLeft', 'onMoveRight']);
  react2AngularDirective('appNotificationsList', AppNotificationList, []);
  react2AngularDirective('pageHeader', PageHeader, ['model', 'noTabs']);
  react2AngularDirective('emptyListCta', EmptyListCTA, [
    'title',
    'buttonIcon',
    'buttonLink',
    'buttonTitle',
    ['onClick', { watchDepth: 'reference', wrapApply: true }],
    'proTip',
    'proTipLink',
    'proTipLinkTitle',
    'proTipTarget',
    'infoBox',
    'infoBoxTitle',
  ]);
  react2AngularDirective('searchField', SearchField, [
    'query',
    'autoFocus',
    ['onChange', { watchDepth: 'reference' }],
    ['onKeyDown', { watchDepth: 'reference' }],
  ]);
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
    'labelWidth',
    ['onReset', { watchDepth: 'reference', wrapApply: true }],
    ['onChange', { watchDepth: 'reference', wrapApply: true }],
  ]);
  react2AngularDirective('graphContextMenu', GraphContextMenu, [
    'x',
    'y',
    'items',
    ['onClose', { watchDepth: 'reference', wrapApply: true }],
    ['getContextMenuSource', { watchDepth: 'reference', wrapApply: true }],
    ['formatSourceDate', { watchDepth: 'reference', wrapApply: true }],
  ]);

  // We keep the drilldown terminology here because of as using data-* directive
  // being in conflict with HTML data attributes
  react2AngularDirective('drilldownLinksEditor', DataLinksEditor, [
    'value',
    'suggestions',
    ['onChange', { watchDepth: 'reference', wrapApply: true }],
  ]);

  react2AngularDirective('reactProfileWrapper', ReactProfileWrapper, []);

  react2AngularDirective('lokiAnnotationsQueryEditor', LokiAnnotationsQueryEditor, [
    'expr',
    'onChange',
    ['datasource', { watchDepth: 'reference' }],
  ]);
  react2AngularDirective('datasourceHttpSettingsNext', DataSourceHttpSettings, [
    'defaultUrl',
    'showAccessOptions',
    'dataSourceConfig',
    ['onChange', { watchDepth: 'reference', wrapApply: true }],
  ]);
}
