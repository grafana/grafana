import { get as lodashGet } from 'lodash';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';
import { optionBuilder } from './options';
export function getConnectionEditor(opts) {
    return {
        category: opts.category,
        path: '--',
        values: (parent) => ({
            getValue: (path) => {
                return lodashGet(opts.connection.info, path);
            },
            // TODO: Fix this any (maybe a dimension supplier?)
            onChange: (path, value) => {
                console.log(value, typeof value);
                let options = opts.connection.info;
                options = setOptionImmutably(options, path, value);
                opts.scene.connections.onChange(opts.connection, options);
            },
        }),
        build: (builder, context) => {
            const ctx = Object.assign(Object.assign({}, context), { options: opts.connection.info });
            optionBuilder.addColor(builder, ctx);
            optionBuilder.addSize(builder, ctx);
        },
    };
}
//# sourceMappingURL=connectionEditor.js.map