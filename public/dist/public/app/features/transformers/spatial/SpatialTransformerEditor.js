import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { DataTransformerID, PluginState, TransformerCategory, } from '@grafana/data';
import { FrameGeometrySourceMode } from '@grafana/schema';
import { useTheme2 } from '@grafana/ui';
import { addLocationFields } from 'app/features/geo/editor/locationEditor';
import { SpatialCalculation, SpatialOperation, SpatialAction } from './models.gen';
import { getDefaultOptions, getTransformerOptionPane } from './optionsHelper';
import { isLineBuilderOption, spatialTransformer } from './spatialTransformer';
// Nothing defined in state
const supplier = (builder, context) => {
    var _a;
    const options = (_a = context.options) !== null && _a !== void 0 ? _a : {};
    builder.addSelect({
        path: `action`,
        name: 'Action',
        description: '',
        defaultValue: SpatialAction.Prepare,
        settings: {
            options: [
                {
                    value: SpatialAction.Prepare,
                    label: 'Prepare spatial field',
                    description: 'Set a geometry field based on the results of other fields',
                },
                {
                    value: SpatialAction.Calculate,
                    label: 'Calculate value',
                    description: 'Use the geometry to define a new field (heading/distance/area)',
                },
                { value: SpatialAction.Modify, label: 'Transform', description: 'Apply spatial operations to the geometry' },
            ],
        },
    });
    if (options.action === SpatialAction.Calculate) {
        builder.addSelect({
            path: `calculate.calc`,
            name: 'Function',
            description: '',
            defaultValue: SpatialCalculation.Heading,
            settings: {
                options: [
                    { value: SpatialCalculation.Heading, label: 'Heading' },
                    { value: SpatialCalculation.Area, label: 'Area' },
                    { value: SpatialCalculation.Distance, label: 'Distance' },
                ],
            },
        });
    }
    else if (options.action === SpatialAction.Modify) {
        builder.addSelect({
            path: `modify.op`,
            name: 'Operation',
            description: '',
            defaultValue: SpatialOperation.AsLine,
            settings: {
                options: [
                    {
                        value: SpatialOperation.AsLine,
                        label: 'As line',
                        description: 'Create a single line feature with a vertex at each row',
                    },
                    {
                        value: SpatialOperation.LineBuilder,
                        label: 'Line builder',
                        description: 'Create a line between two points',
                    },
                ],
            },
        });
    }
    if (isLineBuilderOption(options)) {
        builder.addNestedOptions({
            category: ['Source'],
            path: 'source',
            build: (b, c) => {
                var _a;
                const loc = (_a = options.source) !== null && _a !== void 0 ? _a : {
                    mode: FrameGeometrySourceMode.Auto,
                };
                addLocationFields('Point', '', b, loc);
            },
        });
        builder.addNestedOptions({
            category: ['Target'],
            path: 'modify',
            build: (b, c) => {
                var _a, _b;
                const loc = (_b = (_a = options.modify) === null || _a === void 0 ? void 0 : _a.target) !== null && _b !== void 0 ? _b : {
                    mode: FrameGeometrySourceMode.Auto,
                };
                addLocationFields('Point', 'target.', b, loc);
            },
        });
    }
    else {
        addLocationFields('Location', 'source.', builder, options.source);
    }
};
export const SetGeometryTransformerEditor = (props) => {
    // a new component is created with every change :(
    useEffect(() => {
        var _a;
        if (!((_a = props.options.source) === null || _a === void 0 ? void 0 : _a.mode)) {
            const opts = getDefaultOptions(supplier);
            props.onChange(Object.assign(Object.assign({}, opts), props.options));
            console.log('geometry useEffect', opts);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const styles = getStyles(useTheme2());
    const pane = getTransformerOptionPane(props, supplier);
    return (React.createElement("div", null,
        React.createElement("div", null, pane.items.map((v) => v.render())),
        React.createElement("div", null, pane.categories.map((c) => {
            return (React.createElement("div", { key: c.props.id, className: styles.wrap },
                React.createElement("h5", null, c.props.title),
                React.createElement("div", { className: styles.item }, c.items.map((s) => s.render()))));
        }))));
};
const getStyles = (theme) => {
    return {
        wrap: css `
      margin-bottom: 20px;
    `,
        item: css `
      border-left: 4px solid ${theme.colors.border.strong};
      padding-left: 10px;
    `,
    };
};
export const spatialTransformRegistryItem = {
    id: DataTransformerID.spatial,
    editor: SetGeometryTransformerEditor,
    transformation: spatialTransformer,
    name: spatialTransformer.name,
    description: spatialTransformer.description,
    state: PluginState.alpha,
    categories: new Set([TransformerCategory.PerformSpatialOperations]),
};
//# sourceMappingURL=SpatialTransformerEditor.js.map