import '../angular/dropdown_typeahead';
import '../angular/autofill_event_fix';
import '../angular/metric_segment';
import '../angular/misc';
import '../angular/ng_model_on_blur';
import '../angular/tags';
import '../angular/rebuild_on_change';
import '../angular/give_focus';
import '../angular/diff-view';
import './jquery_extended';
import './partials';
import './components/jsontree/jsontree';
import './components/code_editor/code_editor';
import './components/colorpicker/spectrum_picker';
import './services/search_srv';
import './services/ng_react';
import { colors, JsonExplorer } from '@grafana/ui/';

import { infoPopover } from './components/info_popover';
import { arrayJoin } from '../angular/array_join';
import { switchDirective } from './components/switch';
import { dashboardSelector } from './components/dashboard_selector';
import { queryPartEditorDirective } from './components/query_part/query_part_editor';
import { sqlPartEditorDirective } from './components/sql_part/sql_part_editor';
import { formDropdownDirective } from './components/form_dropdown/form_dropdown';
import 'app/core/services/all';
import './filters/filters';
import coreModule from './core_module';
import appEvents from './app_events';
import { assignModelProperties } from './utils/model_utils';
import { contextSrv } from './services/context_srv';
import { KeybindingSrv } from './services/keybindingSrv';
import { NavModelSrv } from './nav_model_srv';
import { geminiScrollbar } from './components/scroll/scroll';
import { profiler } from './profiler';
import { registerAngularDirectives } from './angular_wrappers';
import TimeSeries, { updateLegendValues } from './time_series2';
import { NavModel } from '@grafana/data';

export {
  profiler,
  registerAngularDirectives,
  arrayJoin,
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
  NavModelSrv,
  NavModel,
  geminiScrollbar,
  TimeSeries,
  updateLegendValues,
};
