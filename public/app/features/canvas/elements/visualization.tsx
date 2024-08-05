import { css } from '@emotion/css';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { DataFrame } from '@grafana/data/';
import { EmbeddedScene, PanelBuilders, SceneDataNode, SceneFlexItem, SceneFlexLayout } from '@grafana/scenes';
import { stylesFactory, usePanelContext } from '@grafana/ui';
import { config } from 'app/core/config';
import { DimensionContext } from 'app/features/dimensions/context';
import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';

import {
  CanvasElementItem,
  CanvasElementOptions,
  CanvasElementProps,
  defaultBgColor,
  defaultTextColor,
} from '../element';
import { Align, VAlign, VizElementConfig, VizElementData } from '../types';

const panelTypes: Array<SelectableValue<string>> = Object.keys(PanelBuilders).map((type) => {
  return { label: type, value: type };
});

const VisualizationDisplay = (props: CanvasElementProps<VizElementConfig, VizElementData>) => {
  const context = usePanelContext();
  const scene = context.instanceState?.scene;

  const { data, config: elementConfig } = props;
  const styles = getStyles(config.theme2, data);

  let panelToEmbed = PanelBuilders.timeseries().setTitle(data?.text ?? 'Visualization');
  if (data?.vizType) {
    // TODO make this better
    panelToEmbed = PanelBuilders[data.vizType as keyof typeof PanelBuilders]().setTitle(data?.text ?? 'Visualization');
  }

  // @TODO: Cleanup?
  let frames = scene?.data?.series as DataFrame[];
  let selectedFrames = frames?.filter(
    (frame) => frame.fields.filter((field) => elementConfig.fields?.includes(field.name)).length > 0
  );
  selectedFrames = selectedFrames?.map((frame) => ({
    ...frame,
    fields: frame.fields.filter((field) => !elementConfig.fields?.includes(field.name)),
  }));

  panelToEmbed.setData(new SceneDataNode({ data: data!.data }));
  const panel = panelToEmbed.build();

  const embeddedPanel = new EmbeddedScene({
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

  return (
    <div className={styles.container}>
      <embeddedPanel.Component model={embeddedPanel} />
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme2, data) => ({
  container: css({
    position: 'absolute',
    height: '100%',
    width: '100%',
    display: 'table',
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
    },
    background: {
      color: {
        fixed: defaultBgColor,
      },
    },
    links: options?.links ?? [],
  }),

  // Called when data changes
  prepareData: (dimensionContext: DimensionContext, elementOptions: CanvasElementOptions<VizElementConfig>) => {
    const vizConfig = elementOptions.config;
    let panelData = dimensionContext.getPanelData();

    if (vizConfig?.fields && vizConfig.fields.length > 1 && panelData) {
      let frames = panelData?.series;
      let selectedFrames =
        frames?.filter((frame) => frame.fields.filter((field) => vizConfig.fields!.includes(field.name)).length > 0) ??
        [];
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
      .addCustomEditor({
        category,
        id: 'textSelector',
        path: 'config.text',
        name: 'Panel Title',
        editor: TextDimensionEditor,
      });
  },
};
