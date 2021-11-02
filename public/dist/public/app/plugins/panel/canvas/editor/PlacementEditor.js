import React from 'react';
import { Button, Field, HorizontalGroup, InlineField, InlineFieldRow } from '@grafana/ui';
import { useObservable } from 'react-use';
import { Subject } from 'rxjs';
import { NumberInput } from 'app/features/dimensions/editors/NumberInput';
var anchors = ['top', 'left', 'bottom', 'right'];
var places = ['top', 'left', 'bottom', 'right', 'width', 'height'];
export var PlacementEditor = function (_a) {
    var item = _a.item;
    var settings = item.settings;
    // Will force a rerender whenever the subject changes
    useObservable((settings === null || settings === void 0 ? void 0 : settings.scene) ? settings.scene.moved : new Subject());
    if (!settings) {
        return React.createElement("div", null, "Loading...");
    }
    var element = settings.element;
    if (!element) {
        return React.createElement("div", null, "???");
    }
    var placement = element.placement;
    return (React.createElement("div", null,
        React.createElement(HorizontalGroup, null, anchors.map(function (a) { return (React.createElement(Button, { key: a, size: "sm", variant: element.anchor[a] ? 'primary' : 'secondary', onClick: function () { return settings.scene.toggleAnchor(element, a); } }, a)); })),
        React.createElement("br", null),
        React.createElement(Field, { label: "Position" },
            React.createElement(React.Fragment, null, places.map(function (p) {
                var v = placement[p];
                if (v == null) {
                    return null;
                }
                return (React.createElement(InlineFieldRow, { key: p },
                    React.createElement(InlineField, { label: p, labelWidth: 8, grow: true },
                        React.createElement(NumberInput, { value: v, onChange: function (v) { return console.log('TODO, edit!!!', p, v); } }))));
            })))));
};
//# sourceMappingURL=PlacementEditor.js.map