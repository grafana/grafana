import { PanelOptionsEditorBuilder } from '@grafana/data';
import { BackgroundImageSize } from 'app/features/canvas';
import { ColorDimensionEditor, ResourceDimensionEditor } from 'app/features/dimensions/editors';

export function addBackgroundOptions(builder: PanelOptionsEditorBuilder<any>) {
  builder
    .addCustomEditor({
      id: 'background.color',
      path: 'background.color',
      name: 'Background Color',
      editor: ColorDimensionEditor,
      settings: {},
      defaultValue: {
        // Configured values
        fixed: '',
      },
    })
    .addCustomEditor({
      id: 'background.image',
      path: 'background.image',
      name: 'Background Image',
      editor: ResourceDimensionEditor,
      settings: {
        resourceType: 'image',
      },
    })
    .addRadio({
      path: 'background.size',
      name: 'Backround image size',
      settings: {
        options: [
          { value: BackgroundImageSize.Original, label: 'Original' },
          { value: BackgroundImageSize.Contain, label: 'Contain' },
          { value: BackgroundImageSize.Cover, label: 'Cover' },
          { value: BackgroundImageSize.Fill, label: 'Fill' },
          { value: BackgroundImageSize.Tile, label: 'Tile' },
        ],
      },
      defaultValue: BackgroundImageSize.Cover,
    });
}

export function addBorderOptions(builder: PanelOptionsEditorBuilder<any>) {
  builder.addSliderInput({
    path: 'border.width',
    name: 'Border Width',
    defaultValue: 2,
    settings: {
      min: 0,
      max: 20,
    },
  });

  builder.addCustomEditor({
    id: 'border.color',
    path: 'border.color',
    name: 'Border Color',
    editor: ColorDimensionEditor,
    settings: {},
    defaultValue: {
      // Configured values
      fixed: '',
    },
    showIf: (cfg) => Boolean(cfg.border?.width),
  });
}
