import './jquery_extended';
import './services/search_srv';
import { colors, JsonExplorer } from '@grafana/ui/';
import 'app/core/services/all';
import coreModule from './core_module';
import appEvents from './app_events';
import { assignModelProperties } from './utils/model_utils';
import { contextSrv } from './services/context_srv';
import { KeybindingSrv } from './services/keybindingSrv';
import { profiler } from './profiler';
import TimeSeries, { updateLegendValues } from './time_series2';

export {
  profiler,
  coreModule,
  appEvents,
  colors,
  assignModelProperties,
  contextSrv,
  KeybindingSrv,
  JsonExplorer,
  TimeSeries,
  updateLegendValues,
};
