import { css } from '@emotion/css';
import React from 'react';
import { useStyles2, useTheme2 } from '@grafana/ui';
export function DataSourceLogo(props) {
    const { dataSource } = props;
    const theme = useTheme2();
    const styles = getStyles(theme, dataSource === null || dataSource === void 0 ? void 0 : dataSource.meta.builtIn);
    if (!dataSource) {
        return DataSourceLogoPlaceHolder();
    }
    return (React.createElement("img", { className: styles.pickerDSLogo, alt: `${dataSource.meta.name} logo`, src: dataSource.meta.info.logos.small }));
}
export function DataSourceLogoPlaceHolder() {
    const styles = useStyles2(getStyles);
    return React.createElement("div", { className: styles.pickerDSLogo });
}
function getStyles(theme, builtIn = false) {
    return {
        pickerDSLogo: css `
      height: 20px;
      width: 20px;
      filter: invert(${builtIn && theme.isLight ? 1 : 0});
    `,
    };
}
//# sourceMappingURL=DataSourceLogo.js.map