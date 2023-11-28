import { css } from '@emotion/css';
import React, { createRef } from 'react';
import { Button, InlineField, InlineFieldRow, Input, LinkButton, Popover, PopoverController, useStyles2, useTheme2, } from '@grafana/ui';
import { closePopover } from '@grafana/ui/src/utils/closePopover';
import { SanitizedSVG } from 'app/core/components/SVG/SanitizedSVG';
import { getPublicOrAbsoluteUrl } from '../resource';
import { ResourcePickerSize } from '../types';
import { ResourcePickerPopover } from './ResourcePickerPopover';
export const ResourcePicker = (props) => {
    const { value, src, name, placeholder, onChange, onClear, mediaType, folderName, size, color } = props;
    const styles = useStyles2(getStyles);
    const theme = useTheme2();
    const pickerTriggerRef = createRef();
    const popoverElement = (React.createElement(ResourcePickerPopover, { onChange: onChange, value: value, mediaType: mediaType, folderName: folderName }));
    let sanitizedSrc = src;
    if (!sanitizedSrc && value) {
        sanitizedSrc = getPublicOrAbsoluteUrl(value);
    }
    const colorStyle = color && {
        fill: theme.visualization.getColorByName(color),
    };
    const renderSmallResourcePicker = () => {
        if (value && sanitizedSrc) {
            return React.createElement(SanitizedSVG, { src: sanitizedSrc, className: styles.icon, style: Object.assign({}, colorStyle) });
        }
        else {
            return (React.createElement(LinkButton, { variant: "primary", fill: "text", size: "sm" }, "Set icon"));
        }
    };
    const renderNormalResourcePicker = () => (React.createElement(InlineFieldRow, null,
        React.createElement(InlineField, { label: null, grow: true },
            React.createElement(Input, { value: getDisplayName(src, name), placeholder: placeholder, readOnly: true, prefix: sanitizedSrc && React.createElement(SanitizedSVG, { src: sanitizedSrc, className: styles.icon, style: Object.assign({}, colorStyle) }), suffix: React.createElement(Button, { icon: "times", variant: "secondary", fill: "text", size: "sm", onClick: onClear }) }))));
    return (React.createElement(PopoverController, { content: popoverElement }, (showPopper, hidePopper, popperProps) => {
        return (React.createElement(React.Fragment, null,
            pickerTriggerRef.current && (React.createElement(Popover, Object.assign({}, popperProps, { referenceElement: pickerTriggerRef.current, onMouseEnter: showPopper, onKeyDown: (event) => {
                    closePopover(event, hidePopper);
                } }))),
            React.createElement("div", { ref: pickerTriggerRef, className: styles.pointer, onClick: showPopper, onKeyDown: (e) => {
                    if (e.key === 'Enter') {
                        showPopper();
                    }
                }, role: "button", tabIndex: 0 },
                size === ResourcePickerSize.SMALL && renderSmallResourcePicker(),
                size === ResourcePickerSize.NORMAL && renderNormalResourcePicker())));
    }));
};
// strip the SVG off icons in the icons folder
function getDisplayName(src, name) {
    var _a;
    if (src === null || src === void 0 ? void 0 : src.startsWith('public/img/icons')) {
        const idx = (_a = name === null || name === void 0 ? void 0 : name.lastIndexOf('.svg')) !== null && _a !== void 0 ? _a : 0;
        if (idx > 0) {
            return name.substring(0, idx);
        }
    }
    return name;
}
const getStyles = (theme) => ({
    pointer: css `
    cursor: pointer;
    input[readonly] {
      cursor: pointer;
    }
  `,
    icon: css `
    vertical-align: middle;
    display: inline-block;
    fill: currentColor;
    width: 25px;
  `,
});
//# sourceMappingURL=ResourcePicker.js.map