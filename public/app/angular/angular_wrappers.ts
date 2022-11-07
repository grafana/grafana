import {
  ClipboardButton,
  ColorPicker,
  DataLinksInlineEditor,
  DataSourceHttpSettings,
  GraphContextMenu,
  Icon,
  LegacyForms,
  SeriesColorPickerPopoverWithTheme,
  Spinner,
  UnitPicker,
} from '@grafana/ui';
import { react2AngularDirective } from 'app/angular/react2angular';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { TimePickerSettings } from 'app/features/dashboard/components/DashboardSettings/TimePickerSettings';
import { QueryEditor as CloudMonitoringQueryEditor } from 'app/plugins/datasource/cloud-monitoring/components/QueryEditor';

import EmptyListCTA from '../core/components/EmptyListCTA/EmptyListCTA';
import { Footer } from '../core/components/Footer/Footer';
import { PageHeader } from '../core/components/PageHeader/PageHeader';
import { MetricSelect } from '../core/components/Select/MetricSelect';
import { TagFilter } from '../core/components/TagFilter/TagFilter';
import { HelpModal } from '../core/components/help/HelpModal';

const { SecretFormField } = LegacyForms;

export function registerAngularDirectives() {
  react2AngularDirective('footer', Footer, []);
  react2AngularDirective('icon', Icon, [
    'name',
    'size',
    'type',
    ['onClick', { watchDepth: 'reference', wrapApply: true }],
  ]);
  react2AngularDirective('spinner', Spinner, ['inline']);
  react2AngularDirective('helpModal', HelpModal, []);
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
  react2AngularDirective('cloudMonitoringQueryEditor', CloudMonitoringQueryEditor, [
    'target',
    'onQueryChange',
    'onExecuteQuery',
    ['events', { watchDepth: 'reference' }],
    ['datasource', { watchDepth: 'reference' }],
    ['templateSrv', { watchDepth: 'reference' }],
  ]);
  react2AngularDirective('secretFormField', SecretFormField, [
    'value',
    'isConfigured',
    'inputWidth',
    'labelWidth',
    'aria-label',
    ['onReset', { watchDepth: 'reference', wrapApply: true }],
    ['onChange', { watchDepth: 'reference', wrapApply: true }],
  ]);
  react2AngularDirective('graphContextMenu', GraphContextMenu, [
    'x',
    'y',
    'itemsGroup',
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

  react2AngularDirective('datasourceHttpSettingsNext', DataSourceHttpSettings, [
    'defaultUrl',
    'showAccessOptions',
    'dataSourceConfig',
    'showForwardOAuthIdentityOption',
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

  react2AngularDirective('timePickerSettings', TimePickerSettings, [
    'renderCount',
    'refreshIntervals',
    'timePickerHidden',
    'nowDelay',
    'timezone',
    ['onTimeZoneChange', { watchDepth: 'reference', wrapApply: true }],
    ['onRefreshIntervalChange', { watchDepth: 'reference', wrapApply: true }],
    ['onNowDelayChange', { watchDepth: 'reference', wrapApply: true }],
    ['onHideTimePickerChange', { watchDepth: 'reference', wrapApply: true }],
  ]);

  react2AngularDirective('clipboardButton', ClipboardButton, [
    ['getText', { watchDepth: 'reference', wrapApply: true }],
  ]);
}
