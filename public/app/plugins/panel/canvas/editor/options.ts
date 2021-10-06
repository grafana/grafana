import { PanelOptionsSupplier } from '@grafana/data/src/panel/PanelPlugin';
import { BackgroundImageSize, CanvasElementOptions } from 'app/features/canvas';
import { ColorDimensionEditor, ResourceDimensionEditor } from 'app/features/dimensions/editors';

interface OptionSuppliers {
  addBackground: PanelOptionsSupplier<CanvasElementOptions>;
  addBorder: PanelOptionsSupplier<CanvasElementOptions>;
}

export const optionBuilder: OptionSuppliers = {
  addBackground: (builder, context) => {
    const category = ['Background'];
    builder
      .addCustomEditor({
        category,
        id: 'background.color',
        path: 'background.color',
        name: 'Color',
        editor: ColorDimensionEditor,
        settings: {},
        defaultValue: {
          // Configured values
          fixed: '',
        },
      })
      .addCustomEditor({
        category,
        id: 'background.image',
        path: 'background.image',
        name: 'Image',
        editor: ResourceDimensionEditor,
        settings: {
          resourceType: 'image',
        },
      })
      .addRadio({
        category,
        path: 'background.size',
        name: 'Image size',
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
  },

  addBorder: (builder, context) => {
    const category = ['Border'];
    builder.addSliderInput({
      category,
      path: 'border.width',
      name: 'Width',
      defaultValue: 2,
      settings: {
        min: 0,
        max: 20,
      },
    });

    if (context.options?.border?.width) {
      builder.addCustomEditor({
        category,
        id: 'border.color',
        path: 'border.color',
        name: 'Color',
        editor: ColorDimensionEditor,
        settings: {},
        defaultValue: {
          // Configured values
          fixed: '',
        },
      });
    }
  },
};
