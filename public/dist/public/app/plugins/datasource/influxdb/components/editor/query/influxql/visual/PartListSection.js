import { css, cx } from '@emotion/css';
import React, { useMemo } from 'react';
import { AccessoryButton } from '@grafana/experimental';
import { MenuGroup, MenuItem, useTheme2, WithContextMenu } from '@grafana/ui';
import { toSelectableValue } from '../utils/toSelectableValue';
import { unwrap } from '../utils/unwrap';
import { AddButton } from './AddButton';
import { Seg } from './Seg';
const renderRemovableNameMenuItems = (onClick) => {
    return (React.createElement(MenuGroup, { label: "" },
        React.createElement(MenuItem, { label: "remove", onClick: onClick })));
};
const noRightMarginPaddingClass = css({
    paddingRight: '0',
    marginRight: '0',
});
const RemovableName = ({ name, onRemove }) => {
    return (React.createElement(WithContextMenu, { renderMenuItems: () => renderRemovableNameMenuItems(onRemove) }, ({ openMenu }) => (React.createElement("button", { className: cx('gf-form-label', noRightMarginPaddingClass), onClick: openMenu }, name))));
};
const noHorizMarginPaddingClass = css({
    paddingLeft: '0',
    paddingRight: '0',
    marginLeft: '0',
    marginRight: '0',
});
const getPartClass = (theme) => {
    return cx('gf-form-label', css({
        paddingLeft: '0',
        // gf-form-label class makes certain css attributes incorrect
        // for the selectbox-dropdown, so we have to "reset" them back
        lineHeight: theme.typography.body.lineHeight,
        fontSize: theme.typography.body.fontSize,
    }));
};
const Part = ({ name, params, onChange, onRemove }) => {
    const theme = useTheme2();
    const partClass = useMemo(() => getPartClass(theme), [theme]);
    const onParamChange = (par, i) => {
        const newParams = params.map((p) => p.value);
        newParams[i] = par;
        onChange(newParams);
    };
    return (React.createElement("div", { className: partClass },
        React.createElement(RemovableName, { name: name, onRemove: onRemove }),
        "(",
        params.map((p, i) => {
            const { value, options } = p;
            const isLast = i === params.length - 1;
            const loadOptions = options !== null ? () => options().then((items) => items.map(toSelectableValue)) : undefined;
            return (React.createElement(React.Fragment, { key: i },
                React.createElement(Seg, { allowCustomValue: true, value: value, buttonClassName: noHorizMarginPaddingClass, loadOptions: loadOptions, onChange: (v) => {
                        onParamChange(unwrap(v.value), i);
                    } }),
                !isLast && ','));
        }),
        ")"));
};
export const PartListSection = ({ parts, getNewPartOptions, onAddNewPart, onRemovePart, onChange, }) => {
    return (React.createElement(React.Fragment, null,
        parts.map((part, index) => (React.createElement(React.Fragment, { key: index },
            React.createElement(Part, { name: part.name, params: part.params, onRemove: () => {
                    onRemovePart(index);
                }, onChange: (pars) => {
                    onChange(index, pars);
                } }),
            React.createElement(AccessoryButton, { style: { marginRight: '4px' }, "aria-label": "remove", icon: "times", variant: "secondary", onClick: () => {
                    onRemovePart(index);
                } })))),
        React.createElement(AddButton, { loadOptions: getNewPartOptions, onAdd: onAddNewPart })));
};
//# sourceMappingURL=PartListSection.js.map