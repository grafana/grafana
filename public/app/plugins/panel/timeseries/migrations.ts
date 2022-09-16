import { omitBy, pickBy, isNil, isNumber, isString } from 'lodash';

import {
  ConfigOverrideRule,
  DynamicConfigValue,
  FieldColorModeId,
  FieldConfig,
  FieldConfigProperty,
  FieldConfigSource,
  FieldMatcherID,
  fieldReducers,
  FieldType,
  NullValueMode,
  PanelTypeChangedHandler,
  Threshold,
  ThresholdsMode,
} from '@grafana/data';
import {
  LegendDisplayMode,
  TooltipDisplayMode,
  AxisPlacement,
  GraphDrawStyle,
  GraphFieldConfig,
  GraphGradientMode,
  GraphTresholdsStyleMode,
  LineInterpolation,
  LineStyle,
  VisibilityMode,
  ScaleDistribution,
  StackingMode,
  SortOrder,
  GraphTransform,
} from '@grafana/schema';

import { defaultGraphConfig } from './config';
import { TimeSeriesOptions } from './types';

/**
 * This is called when the panel changes from another panel
 */
export const graphPanelChangedHandler: PanelTypeChangedHandler = (
  panel,
  prevPluginId,
  prevOptions,
  prevFieldConfig
) => {
  // Changing from angular/flot panel to react/uPlot
  if (prevPluginId === 'graph' && prevOptions.angular) {
    const { fieldConfig, options } = flotToGraphOptions({
      ...prevOptions.angular,
      fieldConfig: prevFieldConfig,
    });
    panel.fieldConfig = fieldConfig; // Mutates the incoming panel
    panel.alert = prevOptions.angular.alert;
    return options;
  }

  //fixes graph -> viz renaming in custom.hideFrom field config by mutation.
  migrateHideFrom(panel);

  return {};
};

export function flotToGraphOptions(angular: any): { fieldConfig: FieldConfigSource; options: TimeSeriesOptions } {
  const overrides: ConfigOverrideRule[] = angular.fieldConfig?.overrides ?? [];
  const yaxes = angular.yaxes ?? [];
  let y1 = getFieldConfigFromOldAxis(yaxes[0]);
  if (angular.fieldConfig?.defaults) {
    y1 = {
      ...angular.fieldConfig?.defaults,
      ...y1, // Keep the y-axis unit and custom
    };
  }

  // Dashes
  const dash: LineStyle = {
    fill: angular.dashes ? 'dash' : 'solid',
    dash: [angular.dashLength ?? 10, angular.spaceLength ?? 10],
  };

  // "seriesOverrides": [
  //   {
  //     "$$hashKey": "object:183",
  //     "alias": "B-series",
  //     "fill": 3,
  //     "nullPointMode": "null as zero",
  //     "lines": true,
  //     "linewidth": 2
  //   }
  // ],

  if (angular.aliasColors) {
    for (const alias of Object.keys(angular.aliasColors)) {
      const color = angular.aliasColors[alias];
      if (color) {
        overrides.push({
          matcher: {
            id: FieldMatcherID.byName,
            options: alias,
          },
          properties: [
            {
              id: FieldConfigProperty.Color,
              value: {
                mode: FieldColorModeId.Fixed,
                fixedColor: color,
              },
            },
          ],
        });
      }
    }
  }

  let hasFillBelowTo = false;

  if (angular.seriesOverrides?.length) {
    for (const seriesOverride of angular.seriesOverrides) {
      if (!seriesOverride.alias) {
        continue; // the matcher config
      }
      const aliasIsRegex = /^([/~@;%#'])(.*?)\1([gimsuy]*)$/.test(seriesOverride.alias);
      const rule: ConfigOverrideRule = {
        matcher: {
          id: aliasIsRegex ? FieldMatcherID.byRegexp : FieldMatcherID.byName,
          options: seriesOverride.alias,
        },
        properties: [],
      };
      let dashOverride: LineStyle | undefined = undefined;

      for (const p of Object.keys(seriesOverride)) {
        const v = seriesOverride[p];
        switch (p) {
          // Ignore
          case 'alias':
          case '$$hashKey':
            break;
          // Link to y axis settings
          case 'yaxis':
            if (2 === v) {
              const y2 = getFieldConfigFromOldAxis(yaxes[1]);
              fillY2DynamicValues(y1, y2, rule.properties);
            }
            break;
          case 'fill':
            rule.properties.push({
              id: 'custom.fillOpacity',
              value: v * 10, // was 0-10, new graph is 0 - 100
            });
            break;
          case 'fillBelowTo':
            hasFillBelowTo = true;
            rule.properties.push({
              id: 'custom.fillBelowTo',
              value: v,
            });
            break;
          case 'fillGradient':
            if (v) {
              rule.properties.push({
                id: 'custom.fillGradient',
                value: 'opacity', // was 0-10
              });
              rule.properties.push({
                id: 'custom.fillOpacity',
                value: v * 10, // was 0-10, new graph is 0 - 100
              });
            }
            break;
          case 'points':
            rule.properties.push({
              id: 'custom.showPoints',
              value: v ? VisibilityMode.Always : VisibilityMode.Never,
            });
            break;
          case 'bars':
            if (v) {
              rule.properties.push({
                id: 'custom.drawStyle',
                value: GraphDrawStyle.Bars,
              });
              rule.properties.push({
                id: 'custom.fillOpacity',
                value: 100, // solid bars
              });
            } else {
              rule.properties.push({
                id: 'custom.drawStyle',
                value: GraphDrawStyle.Line, // Change from bars
              });
            }
            break;
          case 'lines':
            rule.properties.push({
              id: 'custom.lineWidth',
              value: 0, // don't show lines
            });
            break;
          case 'linewidth':
            rule.properties.push({
              id: 'custom.lineWidth',
              value: v,
            });
            break;
          case 'pointradius':
            rule.properties.push({
              id: 'custom.pointSize',
              value: 2 + v * 2,
            });
            break;
          case 'dashLength':
          case 'spaceLength':
          case 'dashes':
            if (!dashOverride) {
              dashOverride = {
                fill: dash.fill,
                dash: [...dash.dash!],
              };
            }
            switch (p) {
              case 'dashLength':
                dashOverride.dash![0] = v;
                break;
              case 'spaceLength':
                dashOverride.dash![1] = v;
                break;
              case 'dashes':
                dashOverride.fill = v ? 'dash' : 'solid';
                break;
            }
            break;
          case 'stack':
            rule.properties.push({
              id: 'custom.stacking',
              value: { mode: StackingMode.Normal, group: v },
            });
            break;
          case 'color':
            rule.properties.push({
              id: 'color',
              value: {
                fixedColor: v,
                mode: FieldColorModeId.Fixed,
              },
            });
            break;
          case 'transform':
            rule.properties.push({
              id: 'custom.transform',
              value: v === 'negative-Y' ? GraphTransform.NegativeY : GraphTransform.Constant,
            });
            break;
          default:
            console.log('Ignore override migration:', seriesOverride.alias, p, v);
        }
      }
      if (dashOverride) {
        rule.properties.push({
          id: 'custom.lineStyle',
          value: dashOverride,
        });
      }
      if (rule.properties.length) {
        overrides.push(rule);
      }
    }
  }

  const graph = y1.custom ?? ({} as GraphFieldConfig);
  graph.drawStyle = angular.bars ? GraphDrawStyle.Bars : angular.lines ? GraphDrawStyle.Line : GraphDrawStyle.Points;

  if (angular.points) {
    graph.showPoints = VisibilityMode.Always;

    if (isNumber(angular.pointradius)) {
      graph.pointSize = 2 + angular.pointradius * 2;
    }
  } else if (graph.drawStyle !== GraphDrawStyle.Points) {
    graph.showPoints = VisibilityMode.Never;
  }

  graph.lineWidth = angular.linewidth;
  if (dash.fill !== 'solid') {
    graph.lineStyle = dash;
  }

  if (hasFillBelowTo) {
    graph.fillOpacity = 35; // bands are hardcoded in flot
  } else if (isNumber(angular.fill)) {
    graph.fillOpacity = angular.fill * 10; // fill was 0 - 10, new is 0 to 100
  }

  if (isNumber(angular.fillGradient) && angular.fillGradient > 0) {
    graph.gradientMode = GraphGradientMode.Opacity;
    graph.fillOpacity = angular.fillGradient * 10; // fill is 0-10
  }

  graph.spanNulls = angular.nullPointMode === NullValueMode.Ignore;

  if (angular.steppedLine) {
    graph.lineInterpolation = LineInterpolation.StepAfter;
  }

  if (graph.drawStyle === GraphDrawStyle.Bars) {
    graph.fillOpacity = 100; // bars were always
  }

  if (angular.stack) {
    graph.stacking = {
      mode: StackingMode.Normal,
      group: defaultGraphConfig.stacking!.group,
    };
  }

  y1.custom = omitBy(graph, isNil);
  y1.nullValueMode = angular.nullPointMode as NullValueMode;

  const options: TimeSeriesOptions = {
    legend: {
      displayMode: LegendDisplayMode.List,
      showLegend: true,
      placement: 'bottom',
      calcs: [],
    },
    tooltip: {
      mode: TooltipDisplayMode.Single,
      sort: SortOrder.None,
    },
  };

  // Legend config migration
  const legendConfig = angular.legend;
  if (legendConfig) {
    if (legendConfig.show) {
      options.legend.displayMode = legendConfig.alignAsTable ? LegendDisplayMode.Table : LegendDisplayMode.List;
    } else {
      options.legend.showLegend = false;
    }

    if (legendConfig.rightSide) {
      options.legend.placement = 'right';
    }

    if (angular.legend.values) {
      const enabledLegendValues = pickBy(angular.legend);
      options.legend.calcs = getReducersFromLegend(enabledLegendValues);
    }

    if (angular.legend.sideWidth) {
      options.legend.width = angular.legend.sideWidth;
    }
  }

  const tooltipConfig = angular.tooltip;
  if (tooltipConfig) {
    if (tooltipConfig.shared !== undefined) {
      options.tooltip.mode = tooltipConfig.shared ? TooltipDisplayMode.Multi : TooltipDisplayMode.Single;
    }

    if (tooltipConfig.sort !== undefined && tooltipConfig.shared) {
      switch (tooltipConfig.sort) {
        case 1:
          options.tooltip.sort = SortOrder.Ascending;
          break;
        case 2:
          options.tooltip.sort = SortOrder.Descending;
          break;
        default:
          options.tooltip.sort = SortOrder.None;
      }
    }
  }

  if (angular.thresholds && angular.thresholds.length > 0) {
    let steps: Threshold[] = [];
    let area = false;
    let line = false;

    const sorted = (angular.thresholds as AngularThreshold[]).sort((a, b) => (a.value > b.value ? 1 : -1));

    for (let idx = 0; idx < sorted.length; idx++) {
      const threshold = sorted[idx];
      const next = sorted.length > idx + 1 ? sorted[idx + 1] : null;

      if (threshold.fill) {
        area = true;
      }

      if (threshold.line) {
        line = true;
      }

      if (threshold.op === 'gt') {
        steps.push({
          value: threshold.value,
          color: getThresholdColor(threshold),
        });
      }

      if (threshold.op === 'lt') {
        if (steps.length === 0) {
          steps.push({
            value: -Infinity,
            color: getThresholdColor(threshold),
          });
        }

        // next op is gt and there is a gap set color to transparent
        if (next && next.op === 'gt' && next.value > threshold.value) {
          steps.push({
            value: threshold.value,
            color: 'transparent',
          });
          // if next is a lt we need to use its color
        } else if (next && next.op === 'lt') {
          steps.push({
            value: threshold.value,
            color: getThresholdColor(next),
          });
        } else {
          steps.push({
            value: threshold.value,
            color: 'transparent',
          });
        }
      }
    }

    // if now less then threshold add an -Infinity base that is transparent
    if (steps.length > 0 && steps[0].value !== -Infinity) {
      steps.unshift({
        color: 'transparent',
        value: -Infinity,
      });
    }

    let displayMode = area ? GraphTresholdsStyleMode.Area : GraphTresholdsStyleMode.Line;
    if (line && area) {
      displayMode = GraphTresholdsStyleMode.LineAndArea;
    }

    // TODO move into standard ThresholdConfig ?
    y1.custom.thresholdsStyle = { mode: displayMode };

    y1.thresholds = {
      mode: ThresholdsMode.Absolute,
      steps,
    };
  }

  if (angular.xaxis && angular.xaxis.show === false && angular.xaxis.mode === 'time') {
    overrides.push({
      matcher: {
        id: FieldMatcherID.byType,
        options: FieldType.time,
      },
      properties: [
        {
          id: 'custom.axisPlacement',
          value: AxisPlacement.Hidden,
        },
      ],
    });
  }
  return {
    fieldConfig: {
      defaults: omitBy(y1, isNil),
      overrides,
    },
    options,
  };
}

function getThresholdColor(threshold: AngularThreshold): string {
  if (threshold.colorMode === 'critical') {
    return 'red';
  }

  if (threshold.colorMode === 'warning') {
    return 'orange';
  }

  if (threshold.colorMode === 'custom') {
    return threshold.fillColor || threshold.lineColor;
  }

  return 'red';
}

interface AngularThreshold {
  op: string;
  fill: boolean;
  line: boolean;
  value: number;
  colorMode: 'critical' | 'warning' | 'custom';
  yaxis?: 'left' | 'right';
  fillColor: string;
  lineColor: string;
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
  if (obj.logBase) {
    const log = obj.logBase as number;
    if (log === 2 || log === 10) {
      graph.scaleDistribution = {
        type: ScaleDistribution.Log,
        log,
      };
    }
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

function fillY2DynamicValues(
  y1: FieldConfig<GraphFieldConfig>,
  y2: FieldConfig<GraphFieldConfig>,
  props: DynamicConfigValue[]
) {
  // The standard properties
  for (const key of Object.keys(y2)) {
    const value = (y2 as any)[key];
    if (key !== 'custom' && value !== (y1 as any)[key]) {
      props.push({
        id: key,
        value,
      });
    }
  }

  // Add any custom property
  const y1G = y1.custom ?? {};
  const y2G = y2.custom ?? {};
  for (const key of Object.keys(y2G)) {
    const value = (y2G as any)[key];
    if (value !== (y1G as any)[key]) {
      props.push({
        id: `custom.${key}`,
        value,
      });
    }
  }
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

function migrateHideFrom(panel: {
  fieldConfig?: { defaults?: { custom?: { hideFrom?: any } }; overrides: ConfigOverrideRule[] };
}) {
  if (panel.fieldConfig?.defaults?.custom?.hideFrom?.graph !== undefined) {
    panel.fieldConfig.defaults.custom.hideFrom.viz = panel.fieldConfig.defaults.custom.hideFrom.graph;
    delete panel.fieldConfig.defaults.custom.hideFrom.graph;
  }
  if (panel.fieldConfig?.overrides) {
    panel.fieldConfig.overrides = panel.fieldConfig.overrides.map((fr) => {
      fr.properties = fr.properties.map((p) => {
        if (p.id === 'custom.hideFrom' && p.value.graph) {
          p.value.viz = p.value.graph;
          delete p.value.graph;
        }
        return p;
      });
      return fr;
    });
  }
}
