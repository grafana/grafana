import { PanelPlugin } from '@grafana/data';
import { IconPanel } from './IconPanel';
import { defaultPanelOptions } from './models.gen';
import { iconItem } from 'app/features/canvas/elements/icon';
import { optionBuilder } from '../canvas/editor/options';
export var plugin = new PanelPlugin(IconPanel)
    .setNoPadding() // extend to panel edges
    .useFieldConfig()
    .setPanelOptions(function (builder) {
    builder.addNestedOptions({
        category: ['Icon'],
        path: 'root',
        // Dynamically fill the selected element
        build: function (builder, ctx) {
            iconItem.registerOptionsUI(builder, ctx);
            optionBuilder.addBackground(builder, ctx);
            optionBuilder.addBorder(builder, ctx);
        },
        defaultValue: defaultPanelOptions.root,
    });
});
//# sourceMappingURL=module.js.map