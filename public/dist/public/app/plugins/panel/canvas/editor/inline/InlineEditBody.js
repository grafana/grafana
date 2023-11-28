import { css } from '@emotion/css';
import { get as lodashGet } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useObservable } from 'react-use';
import { useStyles2 } from '@grafana/ui/src';
import { AddLayerButton } from 'app/core/components/Layers/AddLayerButton';
import { FrameState } from 'app/features/canvas/runtime/frame';
import { OptionsPaneCategory } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { fillOptionsPaneItems } from 'app/features/dashboard/components/PanelEditor/getVisualizationOptions';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';
import { activePanelSubject } from '../../CanvasPanel';
import { addStandardCanvasEditorOptions } from '../../module';
import { InlineEditTabs } from '../../types';
import { getElementTypes, onAddItem } from '../../utils';
import { getElementEditor } from '../element/elementEditor';
import { getLayerEditor } from '../layer/layerEditor';
import { TabsEditor } from './TabsEditor';
export function InlineEditBody() {
    var _a;
    const activePanel = useObservable(activePanelSubject);
    const instanceState = (_a = activePanel === null || activePanel === void 0 ? void 0 : activePanel.panel.context) === null || _a === void 0 ? void 0 : _a.instanceState;
    const styles = useStyles2(getStyles);
    const [activeTab, setActiveTab] = useState(InlineEditTabs.SelectedElement);
    const pane = useMemo(() => {
        var _a;
        const p = activePanel === null || activePanel === void 0 ? void 0 : activePanel.panel;
        const state = instanceState;
        if (!state || !p) {
            return new OptionsPaneCategoryDescriptor({ id: 'root', title: 'root' });
        }
        const supplier = (builder) => {
            if (activeTab === InlineEditTabs.ElementManagement) {
                builder.addNestedOptions(getLayerEditor(instanceState));
            }
            const selection = state.selected;
            if ((selection === null || selection === void 0 ? void 0 : selection.length) === 1 && activeTab === InlineEditTabs.SelectedElement) {
                const element = selection[0];
                if (element && !(element instanceof FrameState)) {
                    builder.addNestedOptions(getElementEditor({
                        category: [`Selected element (${element.options.name})`],
                        element,
                        scene: state.scene,
                    }));
                }
            }
            addStandardCanvasEditorOptions(builder);
        };
        return getOptionsPaneCategoryDescriptor({
            options: p.props.options,
            onChange: p.props.onOptionsChange,
            data: (_a = p.props.data) === null || _a === void 0 ? void 0 : _a.series,
        }, supplier);
    }, [instanceState, activePanel, activeTab]);
    const topLevelItemsContainerStyle = {
        marginLeft: 15,
        marginTop: 10,
    };
    const onTabChange = (tab) => {
        setActiveTab(tab);
    };
    const typeOptions = getElementTypes(instanceState === null || instanceState === void 0 ? void 0 : instanceState.scene.shouldShowAdvancedTypes).options;
    const rootLayer = instanceState === null || instanceState === void 0 ? void 0 : instanceState.layer;
    const noElementSelected = instanceState && activeTab === InlineEditTabs.SelectedElement && instanceState.selected.length === 0;
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { style: topLevelItemsContainerStyle }, pane.items.map((item) => item.render())),
        React.createElement("div", { style: topLevelItemsContainerStyle },
            React.createElement(AddLayerButton, { onChange: (sel) => onAddItem(sel, rootLayer), options: typeOptions, label: 'Add item' })),
        React.createElement("div", { style: topLevelItemsContainerStyle },
            React.createElement(TabsEditor, { onTabChange: onTabChange }),
            pane.categories.map((p) => renderOptionsPaneCategoryDescriptor(p)),
            noElementSelected && React.createElement("div", { className: styles.selectElement }, "Please select an element"))));
}
// Recursively render options
function renderOptionsPaneCategoryDescriptor(pane) {
    return (React.createElement(OptionsPaneCategory, Object.assign({}, pane.props, { key: pane.props.id }),
        React.createElement("div", null, pane.items.map((v) => v.render())),
        pane.categories.map((c) => renderOptionsPaneCategoryDescriptor(c))));
}
function getOptionsPaneCategoryDescriptor(props, supplier) {
    var _a;
    const context = {
        data: (_a = props.data) !== null && _a !== void 0 ? _a : [],
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
const getStyles = (theme) => ({
    selectElement: css `
    color: ${theme.colors.text.secondary};
    padding: ${theme.spacing(2)};
  `,
});
//# sourceMappingURL=InlineEditBody.js.map