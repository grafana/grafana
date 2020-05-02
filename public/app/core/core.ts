import './directives/dropdown_typeahead';
import './directives/autofill_event_fix';
import './directives/metric_segment';
import './directives/misc';
import './directives/ng_model_on_blur';
import './directives/tags';
import './directives/value_select_dropdown';
import './directives/rebuild_on_change';
import './directives/give_focus';
import './directives/diff-view';
import './jquery_extended';
import './partials';
import './components/jsontree/jsontree';
import './components/code_editor/code_editor';
import './utils/outline';
import './components/colorpicker/spectrum_picker';
import './services/search_srv';
import './services/ng_react';
import { colors, JsonExplorer } from '@grafana/ui/';

import { infoPopover } from './components/info_popover';
import { arrayJoin } from './directives/array_join';
import { liveSrv } from './live/live_srv';
import { Emitter } from './utils/emitter';
import { switchDirective } from './components/switch';
import { dashboardSelector } from './components/dashboard_selector';
import { queryPartEditorDirective } from './components/query_part/query_part_editor';
import { sqlPartEditorDirective } from './components/sql_part/sql_part_editor';
import { formDropdownDirective } from './components/form_dropdown/form_dropdown';
import 'app/core/controllers/all';
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
import { updateLegendValues } from './time_series2';
import TimeSeries from './time_series2';
import { NavModel } from '@grafana/data';

export {
  profiler,
  registerAngularDirectives,
  arrayJoin,
  coreModule,
  liveSrv,
  switchDirective,
  infoPopover,
  Emitter,
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
