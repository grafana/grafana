import { css } from '@emotion/css';
import { useCallback, useMemo } from 'react';

import { Field, GrafanaTheme2, SelectableValue, StandardEditorProps } from '@grafana/data';
import { DataFrame } from '@grafana/data/';
import { EmbeddedScene, PanelBuilders, SceneDataNode, SceneFlexItem, SceneFlexLayout } from '@grafana/scenes';
import { TextDimensionMode } from '@grafana/schema/dist/esm/index';
import { MultiSelect, stylesFactory, usePanelContext } from '@grafana/ui';
import { frameHasName, useFieldDisplayNames, useSelectOptions } from '@grafana/ui/src/components/MatchersUI/utils';
import { config } from 'app/core/config';
import { DimensionContext } from 'app/features/dimensions/context';
import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';

import { CanvasElementItem, CanvasElementOptions, CanvasElementProps, defaultTextColor } from '../element';
import { Align, VAlign, VizElementConfig, VizElementData } from '../types';

const panelTypes: Array<SelectableValue<string>> = Object.keys(PanelBuilders).map((type) => {
  return { label: type, value: type };
});

const defaultPanelTitle = 'New Visualization';

const VisualizationDisplay = (props: CanvasElementProps<VizElementConfig, VizElementData>) => {
  const context = usePanelContext();
  const scene = context.instanceState?.scene;

  const { data } = props;
  const styles = getStyles(config.theme2, data, scene);

  const vizType = (data?.vizType ?? 'timeseries') as keyof typeof PanelBuilders;
  const panelTitle = data?.text ?? '';

  // TODO: only re-init this when data has different schema (not on each data change)
  // use compareDataFrameStructures() or probably diff data.data.structureRev
  const embeddedPanel = useMemo(
    () => {
      // TODO make this better
      let panelToEmbed = PanelBuilders[vizType]().setTitle(panelTitle);

      panelToEmbed.setData(new SceneDataNode({ data: data?.data }));
      panelToEmbed.setDisplayMode('transparent');
      panelToEmbed.setColor({ mode: 'palette-classic' });
      // why this no work? series color still by thresholds?
      const panel = panelToEmbed.build();

      return new EmbeddedScene({
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
    <div className={styles.container}>
      <embeddedPanel.Component model={embeddedPanel} />
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme2, data, scene) => ({
  container: css({
    position: 'absolute',
    height: '100%',
    width: '100%',
    display: 'table',
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

    if (vizConfig?.fields && vizConfig.fields.length > 1 && panelData) {
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
      data: panelData,
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
      .addCustomEditor({
        category,
        id: 'textSelector',
        path: 'config.text',
        name: 'Panel Title',
        editor: TextDimensionEditor,
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
