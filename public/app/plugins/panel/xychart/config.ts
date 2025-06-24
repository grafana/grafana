import {
  FieldColorModeId,
  FieldConfigProperty,
  FieldType,
  identityOverrideProcessor,
  SetFieldConfigOptionsArgs,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { LineStyle } from '@grafana/schema';
import { commonOptionsBuilder } from '@grafana/ui';

import { LineStyleEditor } from '../timeseries/LineStyleEditor';

import { FieldConfig, XYShowMode, PointShape } from './panelcfg.gen';

export const DEFAULT_POINT_SIZE = 5;

export function getScatterFieldConfig(cfg: FieldConfig): SetFieldConfigOptionsArgs<FieldConfig> {
  return {
    standardOptions: {
      [FieldConfigProperty.Min]: {
        hideFromDefaults: true,
      },
      [FieldConfigProperty.Max]: {
        hideFromDefaults: true,
      },
      [FieldConfigProperty.Unit]: {
        hideFromDefaults: true,
      },
      [FieldConfigProperty.Decimals]: {
        hideFromDefaults: true,
      },
      [FieldConfigProperty.NoValue]: {
        hideFromDefaults: true,
      },
      [FieldConfigProperty.DisplayName]: {
        hideFromDefaults: true,
      },
      // TODO: this still leaves Color series by: [ Last | Min | Max ]
      // because item.settings?.bySeriesSupport && colorMode.isByValue
      [FieldConfigProperty.Color]: {
        settings: {
          byValueSupport: true,
          bySeriesSupport: true,
          preferThresholdsMode: false,
        },
        defaultValue: {
          mode: FieldColorModeId.PaletteClassic,
        },
      },
      [FieldConfigProperty.Links]: {
        settings: {
          showOneClick: true,
        },
      },
      [FieldConfigProperty.Actions]: {
        hideFromDefaults: false,
      },
    },

    useCustomConfig: (builder) => {
      const category = [t('xychart.category-xychart', 'XY Chart')];
      builder
        .addRadio({
          path: 'show',
          name: t('xychart.name-show', 'Show'),
          category,
          defaultValue: cfg.show,
          settings: {
            options: [
              { label: t('xychart.show-options.label-points', 'Points'), value: XYShowMode.Points },
              { label: t('xychart.show-options.label-lines', 'Lines'), value: XYShowMode.Lines },
              { label: t('xychart.show-options.label-both', 'Both'), value: XYShowMode.PointsAndLines },
            ],
          },
        })
        // .addGenericEditor(
        //   {
        //     path: 'pointSymbol',
        //     name: 'Point symbol',
        //     defaultValue: defaultFieldConfig.pointSymbol ?? {
        //       mode: 'fixed',
        //       fixed: 'img/icons/marker/circle.svg',
        //     },
        //     settings: {
        //       resourceType: MediaType.Icon,
        //       folderName: ResourceFolderName.Marker,
        //       placeholderText: 'Select a symbol',
        //       placeholderValue: 'img/icons/marker/circle.svg',
        //       showSourceRadio: false,
        //     },
        //     showIf: (c) => c.show !== ScatterShow.Lines,
        //   },
        //   SymbolEditor // ResourceDimensionEditor
        // )
        .addSliderInput({
          path: 'pointSize.fixed',
          name: t('xychart.name-point-size', 'Point size'),
          category,
          defaultValue: cfg.pointSize?.fixed ?? DEFAULT_POINT_SIZE,
          settings: {
            min: 1,
            max: 100,
            step: 1,
          },
          showIf: (c) => c.show !== XYShowMode.Lines,
        })
        .addNumberInput({
          path: 'pointSize.min',
          name: t('xychart.name-min-point-size', 'Min point size'),
          category,
          showIf: (c) => c.show !== XYShowMode.Lines,
        })
        .addNumberInput({
          path: 'pointSize.max',
          name: t('xychart.name-max-point-size', 'Max point size'),
          category,
          showIf: (c) => c.show !== XYShowMode.Lines,
        })
        .addRadio({
          path: 'pointShape',
          name: t('xychart.name-point-shape', 'Point shape'),
          category,
          defaultValue: PointShape.Circle,
          settings: {
            options: [
              { value: PointShape.Circle, label: t('xychart.point-shape-options.label-circle', 'Circle') },
              { value: PointShape.Square, label: t('xychart.point-shape-options.label-square', 'Square') },
            ],
          },
          showIf: (c) => c.show !== XYShowMode.Lines,
        })
        .addSliderInput({
          path: 'pointStrokeWidth',
          name: t('xychart.name-point-stroke-width', 'Point stroke width'),
          category,
          defaultValue: 1,
          settings: {
            min: 0,
            max: 10,
          },
          showIf: (c) => c.show !== XYShowMode.Lines,
        })
        .addSliderInput({
          path: 'fillOpacity',
          name: t('xychart.name-fill-opacity', 'Fill opacity'),
          category,
          defaultValue: 50,
          settings: {
            min: 0,
            max: 100,
            step: 1,
          },
          showIf: (c) => c.show !== XYShowMode.Lines,
        })
        .addCustomEditor<void, LineStyle>({
          id: 'lineStyle',
          path: 'lineStyle',
          name: t('xychart.name-line-style', 'Line style'),
          category,
          showIf: (c) => c.show !== XYShowMode.Points,
          editor: LineStyleEditor,
          override: LineStyleEditor,
          process: identityOverrideProcessor,
          shouldApply: (f) => f.type === FieldType.number,
        })
        .addSliderInput({
          path: 'lineWidth',
          name: t('xychart.name-line-width', 'Line width'),
          category,
          defaultValue: cfg.lineWidth,
          settings: {
            min: 0,
            max: 10,
            step: 1,
          },
          showIf: (c) => c.show !== XYShowMode.Points,
        });

      commonOptionsBuilder.addAxisConfig(builder, cfg);
      commonOptionsBuilder.addHideFrom(builder);
    },
  };
}
