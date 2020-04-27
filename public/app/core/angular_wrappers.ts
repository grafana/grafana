import { react2AngularDirective } from 'app/core/utils/react2angular';
import { QueryEditor as StackdriverQueryEditor } from 'app/plugins/datasource/stackdriver/components/QueryEditor';
import { AnnotationQueryEditor as StackdriverAnnotationQueryEditor } from 'app/plugins/datasource/stackdriver/components/AnnotationQueryEditor';
import { AnnotationQueryEditor as CloudWatchAnnotationQueryEditor } from 'app/plugins/datasource/cloudwatch/components/AnnotationQueryEditor';
import PageHeader from './components/PageHeader/PageHeader';
import EmptyListCTA from './components/EmptyListCTA/EmptyListCTA';
import { TagFilter } from './components/TagFilter/TagFilter';
import { SideMenu } from './components/sidemenu/SideMenu';
import { MetricSelect } from './components/Select/MetricSelect';
import AppNotificationList from './components/AppNotifications/AppNotificationList';
import {
  ColorPicker,
  DataSourceHttpSettings,
  GraphContextMenu,
  SeriesColorPickerPopoverWithTheme,
  UnitPicker,
  Icon,
  LegacyForms,
  DataLinksInlineEditor,
} from '@grafana/ui';
const { SecretFormField } = LegacyForms;
import { FunctionEditor } from 'app/plugins/datasource/graphite/FunctionEditor';
import ReactProfileWrapper from 'app/features/profile/ReactProfileWrapper';
import { LokiAnnotationsQueryEditor } from '../plugins/datasource/loki/components/AnnotationsQueryEditor';
import { HelpModal } from './components/help/HelpModal';
import { Footer } from './components/Footer/Footer';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import {
  SaveDashboardAsButtonConnected,
  SaveDashboardButtonConnected,
} from '../features/dashboard/components/SaveDashboard/SaveDashboardButton';
import { VariableEditorContainer } from '../features/variables/editor/VariableEditorContainer';
import { SearchField, SearchResults, SearchWrapper, SearchResultsFilter } from '../features/search';
import { TimePickerSettings } from 'app/features/dashboard/components/DashboardSettings/TimePickerSettings';

export function registerAngularDirectives() {
  react2AngularDirective('footer', Footer, []);
  react2AngularDirective('icon', Icon, [
    'color',
    'name',
    'size',
    'type',
    ['onClick', { watchDepth: 'reference', wrapApply: true }],
  ]);
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
  //Search
  react2AngularDirective('searchField', SearchField, [
    'query',
    'autoFocus',
    ['onChange', { watchDepth: 'reference' }],
    ['onKeyDown', { watchDepth: 'reference' }],
  ]);
  react2AngularDirective('searchResults', SearchResults, [
    'results',
    'editable',
    'selectors',
    ['onSelectionChanged', { watchDepth: 'reference' }],
    ['onTagSelected', { watchDepth: 'reference' }],
    ['onFolderExpanding', { watchDepth: 'reference' }],
    ['onToggleSelection', { watchDepth: 'reference' }],
  ]);
  react2AngularDirective('searchFilters', SearchResultsFilter, [
    'allChecked',
    'canMove',
    'canDelete',
    'tagFilterOptions',
    'selectedStarredFilter',
    'selectedTagFilter',
    ['onSelectAllChanged', { watchDepth: 'reference' }],
    ['deleteItem', { watchDepth: 'reference' }],
    ['moveTo', { watchDepth: 'reference' }],
    ['onStarredFilterChange', { watchDepth: 'reference' }],
    ['onTagFilterChange', { watchDepth: 'reference' }],
  ]);
  react2AngularDirective('searchWrapper', SearchWrapper, []);
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
  react2AngularDirective('unitPicker', UnitPicker, [
    'value',
    'width',
    ['onChange', { watchDepth: 'reference', wrapApply: true }],
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
    ['datasource', { watchDepth: 'reference' }],
    ['templateSrv', { watchDepth: 'reference' }],
  ]);
  react2AngularDirective('cloudwatchAnnotationQueryEditor', CloudWatchAnnotationQueryEditor, [
    'query',
    'onChange',
    ['datasource', { watchDepth: 'reference' }],
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
    ['timeZone', { watchDepth: 'reference', wrapApply: true }],
  ]);

  // We keep the drilldown terminology here because of as using data-* directive
  // being in conflict with HTML data attributes
  react2AngularDirective('drilldownLinksEditor', DataLinksInlineEditor, [
    'value',
    'links',
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
  react2AngularDirective('folderPicker', FolderPicker, [
    'labelClass',
    'rootName',
    'enableCreateNew',
    'enableReset',
    'initialTitle',
    'initialFolderId',
    'dashboardId',
    'onCreateFolder',
    ['enterFolderCreation', { watchDepth: 'reference', wrapApply: true }],
    ['exitFolderCreation', { watchDepth: 'reference', wrapApply: true }],
    ['onLoad', { watchDepth: 'reference', wrapApply: true }],
    ['onChange', { watchDepth: 'reference', wrapApply: true }],
  ]);
  react2AngularDirective('saveDashboardButton', SaveDashboardButtonConnected, [
    ['getDashboard', { watchDepth: 'reference', wrapApply: true }],
    ['onSaveSuccess', { watchDepth: 'reference', wrapApply: true }],
    ['dashboard', { watchDepth: 'reference', wrapApply: true }],
  ]);
  react2AngularDirective('saveDashboardAsButton', SaveDashboardAsButtonConnected, [
    'variant',
    ['getDashboard', { watchDepth: 'reference', wrapApply: true }],
    ['onSaveSuccess', { watchDepth: 'reference', wrapApply: true }],
  ]);
  react2AngularDirective('variableEditorContainer', VariableEditorContainer, []);
  react2AngularDirective('timePickerSettings', TimePickerSettings, [
    ['getDashboard', { watchDepth: 'reference', wrapApply: true }],
    ['onTimeZoneChange', { watchDepth: 'reference', wrapApply: true }],
    ['onRefreshIntervalChange', { watchDepth: 'reference', wrapApply: true }],
    ['onNowDelayChange', { watchDepth: 'reference', wrapApply: true }],
    ['onHideTimePickerChange', { watchDepth: 'reference', wrapApply: true }],
  ]);
}
