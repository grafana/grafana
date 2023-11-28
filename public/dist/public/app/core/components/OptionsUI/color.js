import { css } from '@emotion/css';
import React from 'react';
import { useTheme2, useStyles2, ColorPicker, IconButton } from '@grafana/ui';
import { ColorSwatch } from '@grafana/ui/src/components/ColorPicker/ColorSwatch';
/**
 * @alpha
 * */
export const ColorValueEditor = ({ value, settings, onChange, details }) => {
    const theme = useTheme2();
    const styles = useStyles2(getStyles);
    return (React.createElement(ColorPicker, { color: value !== null && value !== void 0 ? value : '', onChange: onChange, enableNamedColors: (settings === null || settings === void 0 ? void 0 : settings.enableNamedColors) !== false }, ({ ref, showColorPicker, hideColorPicker }) => {
        var _a;
        return (React.createElement("div", { className: styles.spot },
            React.createElement("div", { className: styles.colorPicker },
                React.createElement(ColorSwatch, { ref: ref, onClick: showColorPicker, onMouseLeave: hideColorPicker, color: value ? theme.visualization.getColorByName(value) : theme.components.input.borderColor })),
            details && (React.createElement(React.Fragment, null,
                value ? (
                // TODO: fix keyboard a11y
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                React.createElement("span", { className: styles.colorText, onClick: showColorPicker }, value)) : (
                // TODO: fix keyboard a11y
                // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                React.createElement("span", { className: styles.placeholderText, onClick: showColorPicker }, (_a = settings === null || settings === void 0 ? void 0 : settings.placeholder) !== null && _a !== void 0 ? _a : 'Select color')),
                (settings === null || settings === void 0 ? void 0 : settings.isClearable) && value && (React.createElement(IconButton, { name: "times", onClick: () => onChange(undefined), tooltip: "Clear settings" }))))));
    }));
};
const getStyles = (theme) => {
    return {
        spot: css `
      cursor: pointer;
      color: ${theme.colors.text};
      background: ${theme.components.input.background};
      padding: 3px;
      height: ${theme.v1.spacing.formInputHeight}px;
      border: 1px solid ${theme.components.input.borderColor};
      display: flex;
      flex-direction: row;
      align-items: center;
      align-content: flex-end;
      &:hover {
        border: 1px solid ${theme.components.input.borderHover};
      }
    `,
        colorPicker: css `
      padding: 0 ${theme.spacing(1)};
    `,
        colorText: css `
      flex-grow: 2;
    `,
        placeholderText: css `
      flex-grow: 2;
      color: ${theme.colors.text.secondary};
    `,
    };
};
//# sourceMappingURL=color.js.map