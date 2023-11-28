import { ColorDimensionEditor, ResourceDimensionEditor, ScaleDimensionEditor } from 'app/features/dimensions/editors';
import { BackgroundSizeEditor } from 'app/features/dimensions/editors/BackgroundSizeEditor';
const getCategoryName = (str, type) => {
    if (type !== 'frame' && type !== undefined) {
        return [str + ` (${type})`];
    }
    return [str];
};
export const optionBuilder = {
    addBackground: (builder, context) => {
        var _a;
        const category = getCategoryName('Background', (_a = context.options) === null || _a === void 0 ? void 0 : _a.type);
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
            .addCustomEditor({
            category,
            id: 'background.size',
            path: 'background.size',
            name: 'Image size',
            editor: BackgroundSizeEditor,
            settings: {
                resourceType: 'image',
            },
        });
    },
    addBorder: (builder, context) => {
        var _a, _b, _c;
        const category = getCategoryName('Border', (_a = context.options) === null || _a === void 0 ? void 0 : _a.type);
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
        if ((_c = (_b = context.options) === null || _b === void 0 ? void 0 : _b.border) === null || _c === void 0 ? void 0 : _c.width) {
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
    addColor: (builder, context) => {
        const category = ['Color'];
        builder.addCustomEditor({
            category,
            id: 'color',
            path: 'color',
            name: 'Color',
            editor: ColorDimensionEditor,
            settings: {},
            defaultValue: {
                // Configured values
                fixed: '',
            },
        });
    },
    addSize: (builder, context) => {
        const category = ['Size'];
        builder.addCustomEditor({
            category,
            id: 'size',
            path: 'size',
            name: 'Size',
            editor: ScaleDimensionEditor,
            settings: {
                min: 1,
                max: 10,
            },
            defaultValue: {
                // Configured values
                fixed: 2,
                min: 1,
                max: 10,
            },
        });
    },
};
//# sourceMappingURL=options.js.map