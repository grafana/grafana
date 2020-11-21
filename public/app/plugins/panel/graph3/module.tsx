import { FieldColorModeId, FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { LegendDisplayMode } from '@grafana/ui';
import {
  GraphFieldConfig,
  PointMode,
  GraphMode,
  AxisPlacement,
  graphFieldOptions,
} from '@grafana/ui/src/components/uPlot/config';
import { TimeSeriesEditor } from './editor/TimeSeriesEditor';
import { XYPlotEditor } from './editor/XYPlotEditor';
import { GraphPanel } from './GraphPanel';
import { GraphOptions, GraphType, XYPlotConfig } from './types';

export const plugin = new PanelPlugin<GraphOptions, GraphFieldConfig>(GraphPanel)
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Color]: {
        settings: {
          byValueSupport: false,
        },
        defaultValue: {
          mode: FieldColorModeId.PaletteClassic,
        },
      },
    },
    useCustomConfig: builder => {
      builder
        .addRadio({
          path: 'mode',
          name: 'Display',
          defaultValue: graphFieldOptions.mode[0].value,
          settings: {
            options: graphFieldOptions.mode,
          },
        })
        .addRadio({
          path: 'lineMode',
          name: 'Line interpolation',
          description: 'NOTE: not implemented yet',
          defaultValue: graphFieldOptions.lineMode[0].value,
          settings: {
            options: graphFieldOptions.lineMode,
          },
          showIf: c => !(c.mode === GraphMode.Bar || c.mode === GraphMode.Points),
        })
        .addSliderInput({
          path: 'lineWidth',
          name: 'Line width',
          defaultValue: 1,
          settings: {
            min: 1,
            max: 10,
            step: 1,
          },
          showIf: c => !(c.mode === GraphMode.Bar || c.mode === GraphMode.Points),
        })
        .addSliderInput({
          path: 'fillAlpha',
          name: 'Fill area opacity',
          defaultValue: 0.1,
          settings: {
            min: 0,
            max: 1,
            step: 0.1,
          },
          showIf: c => !(c.mode === GraphMode.Bar || c.mode === GraphMode.Points),
        })
        .addRadio({
          path: 'points',
          name: 'Points',
          description: 'NOTE: auto vs always are currently the same',
          defaultValue: graphFieldOptions.points[0].value,
          settings: {
            options: graphFieldOptions.points,
          },
        })
        .addSliderInput({
          path: 'pointRadius',
          name: 'Point radius',
          defaultValue: 4,
          settings: {
            min: 1,
            max: 10,
            step: 1,
          },
          showIf: c => c.points !== PointMode.Never,
        })
        .addRadio({
          path: 'axisPlacement',
          name: 'Placement',
          category: ['Axis'],
          defaultValue: graphFieldOptions.axisPlacement[0].value,
          settings: {
            options: graphFieldOptions.axisPlacement,
          },
        })
        .addTextInput({
          path: 'axisLabel',
          name: 'Label',
          category: ['Axis'],
          defaultValue: '',
          settings: {
            placeholder: 'Optional text',
          },
          showIf: c => c.axisPlacement !== AxisPlacement.Hidden,
          // no matter what the field type is
          shouldApply: () => true,
        })
        .addNumberInput({
          path: 'axisWidth',
          name: 'Width',
          category: ['Axis'],
          defaultValue: 60,
          settings: {
            placeholder: '60',
          },
          showIf: c => c.axisPlacement !== AxisPlacement.Hidden,
        });
    },
  })
  .setPanelOptions(builder => {
    builder
      .addRadio({
        path: 'type',
        name: 'Graph Type',
        description: '',
        defaultValue: GraphType.Timeseries,
        settings: {
          options: [
            { value: GraphType.Timeseries, label: 'Timeseries', description: 'Time vs numberic values' },
            { value: GraphType.XYPlot, label: 'X vs Y Plot' },
          ],
        },
      })
      .addCustomEditor({
        id: 'timeSeriesConfig',
        path: 'timeseries', // no value actually set
        name: 'Fields',
        defaultValue: undefined,
        editor: TimeSeriesEditor,
        showIf: c => !c.type || c.type === GraphType.Timeseries,
      })
      .addCustomEditor({
        id: 'xyPlotConfig',
        path: 'xy',
        name: 'X vs Y plot',
        defaultValue: {} as XYPlotConfig,
        editor: XYPlotEditor,
        showIf: c => c.type === GraphType.XYPlot,
      })
      .addRadio({
        path: 'tooltipOptions.mode',
        name: 'Tooltip mode',
        description: '',
        defaultValue: 'single',
        settings: {
          options: [
            { value: 'single', label: 'Single' },
            { value: 'multi', label: 'All' },
            { value: 'none', label: 'Hidden' },
          ],
        },
      })
      .addRadio({
        path: 'legend.displayMode',
        name: 'Legend mode',
        description: '',
        defaultValue: LegendDisplayMode.List,
        settings: {
          options: [
            { value: LegendDisplayMode.List, label: 'List' },
            { value: LegendDisplayMode.Table, label: 'Table' },
            { value: LegendDisplayMode.Hidden, label: 'Hidden' },
          ],
        },
      })
      .addRadio({
        path: 'legend.placement',
        name: 'Legend placement',
        description: '',
        defaultValue: 'bottom',
        settings: {
          options: [
            { value: 'bottom', label: 'Bottom' },
            { value: 'right', label: 'Right' },
          ],
        },
        showIf: c => c.legend.displayMode !== LegendDisplayMode.Hidden,
      });
  });
