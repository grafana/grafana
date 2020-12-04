import { FieldConfig, FieldConfigSource, NullValueMode, PanelModel, fieldReducers } from '@grafana/data';
import { GraphFieldConfig, LegendDisplayMode } from '@grafana/ui';
import { AxisPlacement, DrawStyle, LineInterpolation } from '@grafana/ui/src/components/uPlot/config';
import { Options } from './types';
import omitBy from 'lodash/omitBy';
import isNil from 'lodash/isNil';
import { isNumber, isString } from 'lodash';

/**
 * This is called when the panel changes from another panel
 */
export const graphPanelChangedHandler = (
  panel: PanelModel<Partial<Options>> | any,
  prevPluginId: string,
  prevOptions: any
) => {
  // Changing from angular/flot panel to react/uPlot
  if (prevPluginId === 'graph' && prevOptions.angular) {
    const { fieldConfig, options } = flotToGraphOptions(prevOptions.angular);
    panel.fieldConfig = fieldConfig; // Mutates the incoming panel
    return options;
  }

  return {};
};

export function flotToGraphOptions(angular: any): { fieldConfig: FieldConfigSource; options: Options } {
  const overrides = angular.fieldConfig?.overrides ?? [];
  const yaxes = angular.yaxes ?? [];
  let y1 = getFieldConfigFromOldAxis(yaxes[0]);
  if (angular.fieldConfig?.defaults) {
    y1 = {
      ...angular.fieldConfig?.defaults,
      ...y1, // Keep the y-axis unit and custom
    };
  }
  //const y2 = getFieldConfigFromOldAxis(yaxes[1]);

  const graph = y1.custom ?? ({} as GraphFieldConfig);
  graph.drawStyle = angular.bars ? DrawStyle.Bars : angular.lines ? DrawStyle.Line : DrawStyle.Points;
  graph.lineWidth = angular.lineWidth;
  graph.pointSize = angular.pointradius;
  graph.fillOpacity = angular.fill;
  graph.spanNulls = angular.nullPointMode === NullValueMode.Null;
  if (angular.steppedLine) {
    graph.lineInterpolation = LineInterpolation.StepAfter;
  }
  y1.custom = omitBy(graph, isNil);
  y1.nullValueMode = angular.nullPointMode as NullValueMode;

  const options: Options = {
    graph: {},
    legend: {
      displayMode: LegendDisplayMode.List,
      placement: 'bottom',
    },
    tooltipOptions: {
      mode: 'single',
    },
  };

  if (angular.legend?.values) {
    const show = getReducersFromLegend(angular.legend?.values);
    console.log('Migrate Legend', show);
  }

  return {
    fieldConfig: {
      defaults: omitBy(y1, isNil),
      overrides,
    },
    options,
  };
}

// {
//   "label": "Y111",
//   "show": true,
//   "logBase": 10,
//   "min": "0",
//   "max": "1000",
//   "format": "areaMI2",
//   "$$hashKey": "object:19",
//   "decimals": 3
// },
function getFieldConfigFromOldAxis(obj: any): FieldConfig<GraphFieldConfig> {
  if (!obj) {
    return {};
  }
  const graph: GraphFieldConfig = {
    axisPlacement: obj.show ? AxisPlacement.Auto : AxisPlacement.Hidden,
  };
  if (obj.label) {
    graph.axisLabel = obj.label;
  }
  return omitBy(
    {
      unit: obj.format,
      decimals: validNumber(obj.decimals),
      min: validNumber(obj.min),
      max: validNumber(obj.max),
      custom: graph,
    },
    isNil
  );
}

function validNumber(val: any): number | undefined {
  if (isNumber(val)) {
    return val;
  }
  if (isString(val)) {
    const num = Number(val);
    if (!isNaN(num)) {
      return num;
    }
  }
  return undefined;
}

function getReducersFromLegend(obj: Record<string, any>): string[] {
  const ids: string[] = [];
  for (const key of Object.keys(obj)) {
    const r = fieldReducers.getIfExists(key);
    if (r) {
      ids.push(r.id);
    }
  }
  return ids;
}
