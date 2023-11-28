import { set, get as lodashGet } from 'lodash';
import { PanelOptionsEditorBuilder } from '@grafana/data';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { fillOptionsPaneItems } from 'app/features/dashboard/components/PanelEditor/getVisualizationOptions';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';
export function getTransformerOptionPane(props, supplier) {
    const context = {
        data: props.input,
        options: props.options,
    };
    const root = new OptionsPaneCategoryDescriptor({ id: 'root', title: 'root' });
    const getOptionsPaneCategory = (categoryNames) => {
        if (categoryNames === null || categoryNames === void 0 ? void 0 : categoryNames.length) {
            const key = categoryNames[0];
            let sub = root.categories.find((v) => v.props.id === key);
            if (!sub) {
                sub = new OptionsPaneCategoryDescriptor({ id: key, title: key });
                root.categories.push(sub);
            }
            return sub;
        }
        return root;
    };
    const access = {
        getValue: (path) => lodashGet(props.options, path),
        onChange: (path, value) => {
            props.onChange(setOptionImmutably(props.options, path, value));
        },
    };
    // Use the panel options loader
    fillOptionsPaneItems(supplier, access, getOptionsPaneCategory, context);
    return root;
}
export function getDefaultOptions(supplier) {
    const context = {
        data: [],
        options: {},
    };
    const results = {};
    const builder = new PanelOptionsEditorBuilder();
    supplier(builder, context);
    for (const item of builder.getItems()) {
        if (item.defaultValue != null) {
            set(results, item.path, item.defaultValue);
        }
    }
    return results;
}
//# sourceMappingURL=optionsHelper.js.map