import produce from 'immer';
import { FieldColorModeId, FieldConfigSource } from '@grafana/data';
import { GraphDrawStyle, GraphFieldConfig, StackingMode } from '@grafana/schema';
import store from 'app/core/store';

export type FieldConfig = FieldConfigSource<GraphFieldConfig>;

export type ExploreGraphStyle = 'lines' | 'bars' | 'points' | 'stacked_lines' | 'stacked_bars';

const DEFAULT_EXPLORE_GRAPH_STYLE: ExploreGraphStyle = 'lines';

const KEY = 'grafana.explore.style.graph';

// FIXME: this should move to a better place (shared?)
// FIXME2: is this the best way to do this?
class NeverCaseError extends Error {
  constructor(value: never) {
    super('should never happen');
  }
}

export function storeStyle(style: ExploreGraphStyle): void {
  store.set(KEY, style);
}

function loadStyle(): ExploreGraphStyle {
  const data = store.get(KEY);

  if (data === 'lines' || data === 'bars' || data === 'points' || data === 'stacked_lines' || data === 'stacked_bars') {
    return data;
  }

  return DEFAULT_EXPLORE_GRAPH_STYLE;
}

const STYLE_MAPPING = new Map<string, ExploreGraphStyle>([
  [`${GraphDrawStyle.Line},${StackingMode.None}`, 'lines'],
  [`${GraphDrawStyle.Bars},${StackingMode.None}`, 'bars'],
  [`${GraphDrawStyle.Points},${StackingMode.None}`, 'points'],
  [`${GraphDrawStyle.Line},${StackingMode.Normal}`, 'stacked_lines'],
  [`${GraphDrawStyle.Bars},${StackingMode.Normal}`, 'stacked_bars'],
]);

export function getStyle(config: FieldConfig): ExploreGraphStyle {
  const customConf = config.defaults.custom;
  const drawStyle = customConf?.drawStyle ?? GraphDrawStyle.Line;
  const stackingMode = customConf?.stacking?.mode ?? StackingMode.None;

  const maybeStyle = STYLE_MAPPING.get(`${drawStyle},${stackingMode}`);

  // if the fieldConfig is in a strange state,
  // we choose the default
  return maybeStyle ?? DEFAULT_EXPLORE_GRAPH_STYLE;
}

export function updateFieldConfig(config: FieldConfig, style: ExploreGraphStyle): FieldConfig {
  return produce(config, (draft) => {
    if (draft.defaults.custom === undefined) {
      draft.defaults.custom = {};
    }

    const { custom } = draft.defaults;

    if (custom.stacking === undefined) {
      custom.stacking = { group: 'A' };
    }

    switch (style) {
      case 'lines':
        custom.drawStyle = GraphDrawStyle.Line;
        custom.stacking.mode = StackingMode.None;
        custom.fillOpacity = 0;
        break;
      case 'bars':
        custom.drawStyle = GraphDrawStyle.Bars;
        custom.stacking.mode = StackingMode.None;
        custom.fillOpacity = 0;
        break;
      case 'points':
        custom.drawStyle = GraphDrawStyle.Points;
        custom.stacking.mode = StackingMode.None;
        custom.fillOpacity = 0;
        break;
      case 'stacked_lines':
        custom.drawStyle = GraphDrawStyle.Line;
        custom.stacking.mode = StackingMode.Normal;
        custom.fillOpacity = 100;
        break;
      case 'stacked_bars':
        custom.drawStyle = GraphDrawStyle.Bars;
        custom.stacking.mode = StackingMode.Normal;
        custom.fillOpacity = 100;
        break;
      default:
        // should never happen
        throw new NeverCaseError(style);
    }
  });
}

export function getInitialFieldConfig(allowStyleSelect: boolean): FieldConfig {
  const base: FieldConfig = {
    defaults: {
      color: {
        mode: FieldColorModeId.PaletteClassic,
      },
      custom: {
        fillOpacity: 0,
        pointSize: 5,
      },
    },
    overrides: [],
  };

  const style = allowStyleSelect ? loadStyle() : DEFAULT_EXPLORE_GRAPH_STYLE;

  return updateFieldConfig(base, style);
}
