import './jquery_extended';
import '../angular/components/jsontree';
import '../angular/components/code_editor/code_editor';
import './components/colorpicker/spectrum_picker';
import './services/search_srv';
import { colors, JsonExplorer } from '@grafana/ui/';
import { infoPopover } from './components/info_popover';
import { switchDirective } from './components/switch';
import { dashboardSelector } from './components/dashboard_selector';
import { sqlPartEditorDirective } from './components/sql_part/sql_part_editor';
import 'app/core/services/all';
import coreModule from './core_module';
import appEvents from './app_events';
import { assignModelProperties } from './utils/model_utils';
import { contextSrv } from './services/context_srv';
import { KeybindingSrv } from './services/keybindingSrv';
import { geminiScrollbar } from '../angular/components/scroll';
import { profiler } from './profiler';
import TimeSeries, { updateLegendValues } from './time_series2';

export {
  profiler,
  coreModule,
  switchDirective,
  infoPopover,
  appEvents,
  dashboardSelector,
  sqlPartEditorDirective,
  colors,
  assignModelProperties,
  contextSrv,
  KeybindingSrv,
  JsonExplorer,
  geminiScrollbar,
  TimeSeries,
  updateLegendValues,
};
