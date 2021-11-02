import tinycolor from 'tinycolor2';
export function cardChrome(theme) {
    return "\n    background: " + theme.colors.background.secondary + ";\n    &:hover {\n      background: " + hoverColor(theme.colors.background.secondary, theme) + ";\n    }\n    box-shadow: " + theme.components.panel.boxShadow + ";\n    border-radius: " + theme.shape.borderRadius(2) + ";\n";
}
export function hoverColor(color, theme) {
    return theme.isDark ? tinycolor(color).brighten(2).toString() : tinycolor(color).darken(2).toString();
}
export function listItem(theme) {
    return "\n  background: " + theme.colors.background.secondary + ";\n  &:hover {\n    background: " + hoverColor(theme.colors.background.secondary, theme) + ";\n  }\n  box-shadow: " + theme.components.panel.boxShadow + ";\n  border-radius: " + theme.shape.borderRadius(2) + ";\n";
}
export function listItemSelected(theme) {
    return "\n    background: " + hoverColor(theme.colors.background.secondary, theme) + ";\n    color: " + theme.colors.text.maxContrast + ";\n";
}
export function mediaUp(breakpoint) {
    return "only screen and (min-width: " + breakpoint + ")";
}
export var focusCss = function (theme) { return "\n  outline: 2px dotted transparent;\n  outline-offset: 2px;\n  box-shadow: 0 0 0 2px " + theme.colors.bodyBg + ", 0 0 0px 4px " + theme.colors.formFocusOutline + ";\n  transition: all 0.2s cubic-bezier(0.19, 1, 0.22, 1);\n"; };
export function getMouseFocusStyles(theme) {
    return {
        outline: 'none',
        boxShadow: "none",
    };
}
export function getFocusStyles(theme) {
    return {
        outline: '2px dotted transparent',
        outlineOffset: '2px',
        boxShadow: "0 0 0 2px " + theme.colors.background.canvas + ", 0 0 0px 4px " + theme.colors.primary.main,
        transition: "all 0.2s cubic-bezier(0.19, 1, 0.22, 1)",
    };
}
// max-width is set up based on .grafana-tooltip class that's used in dashboard
export var getTooltipContainerStyles = function (theme) { return "\n  overflow: hidden;\n  background: " + theme.colors.background.secondary + ";\n  box-shadow: " + theme.shadows.z2 + ";\n  max-width: 800px;\n  padding: " + theme.spacing(1) + ";\n  border-radius: " + theme.shape.borderRadius() + ";\n  z-index: " + theme.zIndex.tooltip + ";\n"; };
//# sourceMappingURL=mixins.js.map