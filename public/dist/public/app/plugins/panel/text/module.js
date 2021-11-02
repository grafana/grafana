import { PanelPlugin } from '@grafana/data';
import { TextPanel } from './TextPanel';
import { textPanelMigrationHandler } from './textPanelMigrationHandler';
import { TextPanelEditor } from './TextPanelEditor';
import { defaultPanelOptions, TextMode } from './models.gen';
import { TextPanelSuggestionSupplier } from './suggestions';
export var plugin = new PanelPlugin(TextPanel)
    .setPanelOptions(function (builder) {
    builder
        .addRadio({
        path: 'mode',
        name: 'Mode',
        description: 'text mode of the panel',
        settings: {
            options: [
                { value: TextMode.Markdown, label: 'Markdown' },
                { value: TextMode.HTML, label: 'HTML' },
            ],
        },
        defaultValue: defaultPanelOptions.mode,
    })
        .addCustomEditor({
        id: 'content',
        path: 'content',
        name: 'Content',
        description: 'Content of the panel',
        editor: TextPanelEditor,
        defaultValue: defaultPanelOptions.content,
    });
})
    .setMigrationHandler(textPanelMigrationHandler)
    .setSuggestionsSupplier(new TextPanelSuggestionSupplier());
//# sourceMappingURL=module.js.map