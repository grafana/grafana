import { BackgroundImageSize } from 'app/features/canvas';
import { ColorDimensionEditor, ResourceDimensionEditor } from 'app/features/dimensions/editors';
export var optionBuilder = {
    addBackground: function (builder, context) {
        var category = ['Background'];
        builder
            .addCustomEditor({
            category: category,
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
            category: category,
            id: 'background.image',
            path: 'background.image',
            name: 'Image',
            editor: ResourceDimensionEditor,
            settings: {
                resourceType: 'image',
            },
        })
            .addRadio({
            category: category,
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
    addBorder: function (builder, context) {
        var _a, _b;
        var category = ['Border'];
        builder.addSliderInput({
            category: category,
            path: 'border.width',
            name: 'Width',
            defaultValue: 2,
            settings: {
                min: 0,
                max: 20,
            },
        });
        if ((_b = (_a = context.options) === null || _a === void 0 ? void 0 : _a.border) === null || _b === void 0 ? void 0 : _b.width) {
            builder.addCustomEditor({
                category: category,
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
//# sourceMappingURL=options.js.map