import { css } from '@emotion/css';
import { useCallback, useMemo } from 'react';

import { Field, GrafanaTheme2, SelectableValue, StandardEditorProps } from '@grafana/data';
import { DataFrame } from '@grafana/data/';
import {
  EmbeddedScene,
  PanelBuilders,
  SceneDataNode,
  SceneFlexItem,
  SceneFlexLayout,
  SceneTimeRange,
} from '@grafana/scenes';
import { TextDimensionMode } from '@grafana/schema/dist/esm/index';
import { MultiSelect, stylesFactory, usePanelContext } from '@grafana/ui';
import { frameHasName, useFieldDisplayNames, useSelectOptions } from '@grafana/ui/src/components/MatchersUI/utils';
import { config } from 'app/core/config';
import { DimensionContext } from 'app/features/dimensions/context';
import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';
import { ParamsEditor } from 'app/plugins/panel/canvas/editor/element/ParamsEditor';

import { CanvasElementItem, CanvasElementOptions, CanvasElementProps, defaultTextColor } from '../element';
import { Align, VAlign, VizElementConfig, VizElementData } from '../types';

const panelTypeExcludes = ['datagrid', 'logs', 'news'];
const panelTypes: Array<SelectableValue<string>> = Object.keys(PanelBuilders)
  .filter((type) => !panelTypeExcludes.includes(type))
  .map((type) => {
    return { label: type, value: type };
  });

const defaultPanelTitle = 'New Visualization';

export const CANVAS_EMBEDDED_SCENE_KEY = 'canvas-embedded-scene';

const VisualizationDisplay = (props: CanvasElementProps<VizElementConfig, VizElementData>) => {
  const context = usePanelContext();
  const scene = context.instanceState?.scene;

  const { data } = props;
  const styles = getStyles(config.theme2, data, scene);

  const vizType = (data?.vizType ?? 'timeseries') as keyof typeof PanelBuilders;
  const customOptions = data?.customOptions;
  const showLegend = data?.showLegend;
  const panelTitle = data?.text ?? '';

  // TODO: only re-init this when data has different schema (not on each data change)
  // use compareDataFrameStructures() or probably diff data.data.structureRev
  const embeddedPanel = useMemo(
    () => {
      // TODO make this better
      let panelToEmbed = PanelBuilders[vizType]().setTitle(panelTitle);
      if (customOptions) {
        customOptions.map((value) => {
          // Trying both for now to keep it generic and easy to customize
          panelToEmbed.setOption(value[0], value[1]);
          panelToEmbed.setCustomFieldConfig(value[0], value[1]);
        });
      }

      if (!showLegend) {
        panelToEmbed.setOption('legend', { showLegend: false });
      }

      panelToEmbed.setData(new SceneDataNode({ data: data?.data }));
      panelToEmbed.setDisplayMode('transparent');
      // why this no work? series color still by thresholds?
      panelToEmbed.setColor({ mode: 'palette-classic' });
      const panel = panelToEmbed.build();

      const timeRange = data?.data?.timeRange;
      const sceneTimeRange = new SceneTimeRange({
        from: timeRange?.raw.from.toString(),
        to: timeRange?.raw.to.toString(),
      });

      return new EmbeddedScene({
        $timeRange: sceneTimeRange,
        key: CANVAS_EMBEDDED_SCENE_KEY,
        body: new SceneFlexLayout({
          children: [
            new SceneFlexItem({
              width: '100%',
              height: '100%',
              body: panel,
            }),
          ],
        }),
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vizType, panelTitle, data?.data]
  );

  return (
    <div className={styles.outerContainer}>
      <div className={styles.container}>
        <embeddedPanel.Component model={embeddedPanel} />
      </div>
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme2, data, scene) => ({
  outerContainer: css({
    height: '100%',
    width: '100%',
  }),
  container: css({
    position: 'absolute',
    height: '100%',
    width: '100%',
    display: 'flex',
    pointerEvents: scene?.isEditingEnabled ? 'none' : 'auto',
  }),
}));

export const visualizationItem: CanvasElementItem<VizElementConfig, VizElementData> = {
  id: 'visualization',
  name: 'Visualization',
  description: 'Visualization',

  display: VisualizationDisplay,

  defaultSize: {
    width: 240,
    height: 160,
  },

  getNewOptions: (options) => ({
    ...options,
    config: {
      align: Align.Center,
      valign: VAlign.Middle,
      color: {
        fixed: defaultTextColor,
      },
      vizType: 'timeseries',
      fields: options?.fields ?? [],
      text: { mode: TextDimensionMode.Fixed, fixed: defaultPanelTitle },
      showLegend: true,
    },
    background: {
      color: {
        fixed: config.theme2.colors.background.canvas,
      },
    },
    links: options?.links ?? [],
  }),

  // Called when data changes
  prepareData: (dimensionContext: DimensionContext, elementOptions: CanvasElementOptions<VizElementConfig>) => {
    const vizConfig = elementOptions.config;
    let panelData = dimensionContext.getPanelData();

    const getMatchingFields = (frame: DataFrame) => {
      let fields: Field[] = [];
      frame.fields.forEach((field) => {
        if (field.type === 'time' || vizConfig?.fields?.includes(field.name)) {
          fields.push(field);
        }
      });

      return fields;
    };

    if (vizConfig?.fields && vizConfig.fields.length >= 1 && panelData) {
      let frames = panelData?.series;
      let selectedFrames =
        frames?.filter((frame) => frame.fields.filter((field) => vizConfig.fields!.includes(field.name)).length > 0) ??
        [];

      selectedFrames = selectedFrames?.map((frame) => ({
        ...frame,
        fields: getMatchingFields(frame),
      }));

      panelData = {
        ...panelData,
        series: selectedFrames,
      };
    }

    const data: VizElementData = {
      text: vizConfig?.text ? dimensionContext.getText(vizConfig.text).value() : '',
      field: vizConfig?.text?.field,
      align: vizConfig?.align ?? Align.Center,
      valign: vizConfig?.valign ?? VAlign.Middle,
      size: vizConfig?.size,
      vizType: vizConfig?.vizType,
      customOptions: vizConfig?.customOptions,
      data: panelData,
      showLegend: vizConfig?.showLegend,
    };

    if (vizConfig?.color) {
      data.color = dimensionContext.getColor(vizConfig.color).value();
    }

    return data;
  },

  // Heatmap overlay options
  registerOptionsUI: (builder) => {
    const category = ['Visualization'];
    builder
      .addSelect({
        category,
        path: 'config.vizType',
        name: 'Viz Type',
        settings: {
          options: panelTypes,
        },
      })
      // data source, maybe refid(s), frame(s), field(s)
      .addCustomEditor({
        category,
        id: 'fields',
        path: 'config.fields',
        name: 'Fields',
        editor: FieldsPickerEditor,
      })
      .addBooleanSwitch({
        category,
        path: 'config.showLegend',
        name: 'Show Legend',
      })
      .addCustomEditor({
        category,
        id: 'textSelector',
        path: 'config.text',
        name: 'Panel Title',
        editor: TextDimensionEditor,
      })
      .addCustomEditor({
        category,
        id: 'customOptionsEditor',
        path: 'config.customOptions',
        name: 'Custom Options',
        editor: OptionsEditor,
      });
  },
};

type FieldsPickerEditorProps = StandardEditorProps<string[], any>;

export const FieldsPickerEditor = ({ value, context, onChange: onChangeFromProps }: FieldsPickerEditorProps) => {
  const names = useFieldDisplayNames(context.data);
  const selectOptions = useSelectOptions(names, undefined);

  const onChange = useCallback(
    (selections: Array<SelectableValue<string>>) => {
      if (!Array.isArray(selections)) {
        return;
      }

      return onChangeFromProps(
        selections.reduce((all: string[], current) => {
          if (!frameHasName(current.value, names)) {
            return all;
          }
          all.push(current.value!);
          return all;
        }, [])
      );
    },
    [names, onChangeFromProps]
  );

  return <MultiSelect value={value} options={selectOptions} onChange={onChange} />;
};

interface OptionsEditorProps {
  value: Array<[string, string]>;
  onChange: (v: Array<[string, string]>) => void;
}
export const OptionsEditor = ({ value, onChange }: OptionsEditorProps) => {
  return <ParamsEditor value={value ?? []} onChange={onChange} />;
};
