import React from 'react';
import { useObservable } from 'react-use';
import { Subject } from 'rxjs';
import { Field, HorizontalGroup, Icon, InlineField, InlineFieldRow, Select, VerticalGroup } from '@grafana/ui';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';
import { HorizontalConstraint, VerticalConstraint } from 'app/features/canvas';
import { ConstraintSelectionBox } from './ConstraintSelectionBox';
import { QuickPositioning } from './QuickPositioning';
const places = ['top', 'left', 'bottom', 'right', 'width', 'height'];
const horizontalOptions = [
    { label: 'Left', value: HorizontalConstraint.Left },
    { label: 'Right', value: HorizontalConstraint.Right },
    { label: 'Left & right', value: HorizontalConstraint.LeftRight },
    { label: 'Center', value: HorizontalConstraint.Center },
    { label: 'Scale', value: HorizontalConstraint.Scale },
];
const verticalOptions = [
    { label: 'Top', value: VerticalConstraint.Top },
    { label: 'Bottom', value: VerticalConstraint.Bottom },
    { label: 'Top & bottom', value: VerticalConstraint.TopBottom },
    { label: 'Center', value: VerticalConstraint.Center },
    { label: 'Scale', value: VerticalConstraint.Scale },
];
export function PlacementEditor({ item }) {
    var _a, _b;
    const settings = item.settings;
    // Will force a rerender whenever the subject changes
    useObservable((settings === null || settings === void 0 ? void 0 : settings.scene) ? settings.scene.moved : new Subject());
    if (!settings) {
        return React.createElement("div", null, "Loading...");
    }
    const element = settings.element;
    if (!element) {
        return React.createElement("div", null, "???");
    }
    const { options } = element;
    const { placement, constraint: layout } = options;
    const reselectElementAfterChange = () => {
        setTimeout(() => {
            settings.scene.select({ targets: [element.div] });
        });
    };
    const onHorizontalConstraintSelect = (h) => {
        onHorizontalConstraintChange(h.value);
    };
    const onHorizontalConstraintChange = (h) => {
        element.options.constraint.horizontal = h;
        element.setPlacementFromConstraint();
        settings.scene.revId++;
        settings.scene.save(true);
        reselectElementAfterChange();
    };
    const onVerticalConstraintSelect = (v) => {
        onVerticalConstraintChange(v.value);
    };
    const onVerticalConstraintChange = (v) => {
        element.options.constraint.vertical = v;
        element.setPlacementFromConstraint();
        settings.scene.revId++;
        settings.scene.save(true);
        reselectElementAfterChange();
    };
    const onPositionChange = (value, placement) => {
        element.options.placement[placement] = value !== null && value !== void 0 ? value : element.options.placement[placement];
        element.applyLayoutStylesToDiv();
        settings.scene.clearCurrentSelection(true);
        reselectElementAfterChange();
    };
    const constraint = (_b = (_a = element.tempConstraint) !== null && _a !== void 0 ? _a : layout) !== null && _b !== void 0 ? _b : {};
    return (React.createElement("div", null,
        React.createElement(QuickPositioning, { onPositionChange: onPositionChange, settings: settings, element: element }),
        React.createElement("br", null),
        React.createElement(Field, { label: "Constraints" },
            React.createElement(HorizontalGroup, null,
                React.createElement(ConstraintSelectionBox, { onVerticalConstraintChange: onVerticalConstraintChange, onHorizontalConstraintChange: onHorizontalConstraintChange, currentConstraints: constraint }),
                React.createElement(VerticalGroup, null,
                    React.createElement(HorizontalGroup, null,
                        React.createElement(Icon, { name: "arrows-h" }),
                        React.createElement(Select, { options: horizontalOptions, onChange: onHorizontalConstraintSelect, value: constraint.horizontal })),
                    React.createElement(HorizontalGroup, null,
                        React.createElement(Icon, { name: "arrows-v" }),
                        React.createElement(Select, { options: verticalOptions, onChange: onVerticalConstraintSelect, value: constraint.vertical }))))),
        React.createElement("br", null),
        React.createElement(Field, { label: "Position" },
            React.createElement(React.Fragment, null, places.map((p) => {
                const v = placement[p];
                if (v == null) {
                    return null;
                }
                return (React.createElement(InlineFieldRow, { key: p },
                    React.createElement(InlineField, { label: p, labelWidth: 8, grow: true },
                        React.createElement(NumberInput, { value: v, onChange: (v) => onPositionChange(v, p) }))));
            })))));
}
//# sourceMappingURL=PlacementEditor.js.map