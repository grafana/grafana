import React, { useMemo } from 'react';
import { cx, css } from '@emotion/css';
import { MenuItem, WithContextMenu, MenuGroup, useTheme2 } from '@grafana/ui';
import { Seg } from './Seg';
import { unwrap } from './unwrap';
import { toSelectableValue } from './toSelectableValue';
import { AddButton } from './AddButton';
var renderRemovableNameMenuItems = function (onClick) {
    return (React.createElement(MenuGroup, { label: "" },
        React.createElement(MenuItem, { label: "remove", onClick: onClick })));
};
var noRightMarginPaddingClass = css({
    paddingRight: '0',
    marginRight: '0',
});
var RemovableName = function (_a) {
    var name = _a.name, onRemove = _a.onRemove;
    return (React.createElement(WithContextMenu, { renderMenuItems: function () { return renderRemovableNameMenuItems(onRemove); } }, function (_a) {
        var openMenu = _a.openMenu;
        return (React.createElement("button", { className: cx('gf-form-label', noRightMarginPaddingClass), onClick: openMenu }, name));
    }));
};
var noHorizMarginPaddingClass = css({
    paddingLeft: '0',
    paddingRight: '0',
    marginLeft: '0',
    marginRight: '0',
});
var getPartClass = function (theme) {
    return cx('gf-form-label', css({
        paddingLeft: '0',
        // gf-form-label class makes certain css attributes incorrect
        // for the selectbox-dropdown, so we have to "reset" them back
        lineHeight: theme.typography.body.lineHeight,
        fontSize: theme.typography.body.fontSize,
    }));
};
var Part = function (_a) {
    var name = _a.name, params = _a.params, onChange = _a.onChange, onRemove = _a.onRemove;
    var theme = useTheme2();
    var partClass = useMemo(function () { return getPartClass(theme); }, [theme]);
    var onParamChange = function (par, i) {
        var newParams = params.map(function (p) { return p.value; });
        newParams[i] = par;
        onChange(newParams);
    };
    return (React.createElement("div", { className: partClass },
        React.createElement(RemovableName, { name: name, onRemove: onRemove }),
        "(",
        params.map(function (p, i) {
            var value = p.value, options = p.options;
            var isLast = i === params.length - 1;
            var loadOptions = options !== null ? function () { return options().then(function (items) { return items.map(toSelectableValue); }); } : undefined;
            return (React.createElement(React.Fragment, { key: i },
                React.createElement(Seg, { allowCustomValue: true, value: value, buttonClassName: noHorizMarginPaddingClass, loadOptions: loadOptions, onChange: function (v) {
                        onParamChange(unwrap(v.value), i);
                    } }),
                !isLast && ','));
        }),
        ")"));
};
export var PartListSection = function (_a) {
    var parts = _a.parts, getNewPartOptions = _a.getNewPartOptions, onAddNewPart = _a.onAddNewPart, onRemovePart = _a.onRemovePart, onChange = _a.onChange;
    return (React.createElement(React.Fragment, null,
        parts.map(function (part, index) { return (React.createElement(Part, { key: index, name: part.name, params: part.params, onRemove: function () {
                onRemovePart(index);
            }, onChange: function (pars) {
                onChange(index, pars);
            } })); }),
        React.createElement(AddButton, { loadOptions: getNewPartOptions, onAdd: onAddNewPart })));
};
//# sourceMappingURL=PartListSection.js.map