import './jquery_extended';
import './components/jsontree/jsontree';
import './components/code_editor/code_editor';
import './components/colorpicker/spectrum_picker';
import './services/search_srv';
import { colors, JsonExplorer } from '@grafana/ui/';
import { infoPopover } from './components/info_popover';
import { switchDirective } from './components/switch';
import { dashboardSelector } from './components/dashboard_selector';
import { queryPartEditorDirective } from './components/query_part/query_part_editor';
import { sqlPartEditorDirective } from './components/sql_part/sql_part_editor';
import { formDropdownDirective } from './components/form_dropdown/form_dropdown';
import 'app/core/services/all';
import coreModule from './core_module';
import appEvents from './app_events';
import { assignModelProperties } from './utils/model_utils';
import { contextSrv } from './services/context_srv';
import { KeybindingSrv } from './services/keybindingSrv';
import { geminiScrollbar } from './components/scroll/scroll';
import { profiler } from './profiler';
import { registerAngularDirectives } from '../angular/angular_wrappers';
import TimeSeries, { updateLegendValues } from './time_series2';

export {
  profiler,
  registerAngularDirectives,
  coreModule,
  switchDirective,
  infoPopover,
  appEvents,
  dashboardSelector,
  queryPartEditorDirective,
  sqlPartEditorDirective,
  colors,
  formDropdownDirective,
  assignModelProperties,
  contextSrv,
  KeybindingSrv,
  JsonExplorer,
  geminiScrollbar,
  TimeSeries,
  updateLegendValues,
};
