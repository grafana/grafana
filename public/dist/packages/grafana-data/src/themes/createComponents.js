export function createComponents(colors, shadows) {
    var panel = {
        padding: 1,
        headerHeight: 4,
        background: colors.background.primary,
        borderColor: colors.border.weak,
        boxShadow: 'none',
    };
    var input = {
        borderColor: colors.border.medium,
        borderHover: colors.border.strong,
        text: colors.text.primary,
        background: colors.mode === 'dark' ? colors.background.canvas : colors.background.primary,
    };
    return {
        height: {
            sm: 3,
            md: 4,
            lg: 6,
        },
        input: input,
        panel: panel,
        dropdown: {
            background: input.background,
        },
        tooltip: {
            background: colors.mode === 'light' ? '#555' : colors.background.secondary,
            text: colors.mode === 'light' ? '#FFF' : colors.text.primary,
        },
        dashboard: {
            background: colors.background.canvas,
            padding: 1,
        },
        overlay: {
            background: colors.mode === 'dark' ? 'rgba(0, 0, 0, 0.45)' : 'rgba(208, 209, 211, 0.24)',
        },
        sidemenu: {
            width: 48,
        },
    };
}
//# sourceMappingURL=createComponents.js.map