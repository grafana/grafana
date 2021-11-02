import config from 'app/core/config';
export function getThemeColor(dark, light) {
    return config.bootData.user.lightTheme ? light : dark;
}
//# sourceMappingURL=colors.js.map