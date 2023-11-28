import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
export function DataSourcesInfo({ datasources }) {
    const styles = useStyles2(getStyles);
    const displayDs = datasources.map((ds) => {
        var _a, _b, _c, _d;
        return (React.createElement("div", { key: ds.uid },
            ((_a = ds.settings) === null || _a === void 0 ? void 0 : _a.meta.info.logos.small) && (React.createElement("img", { className: styles.dsImage, src: (_b = ds.settings) === null || _b === void 0 ? void 0 : _b.meta.info.logos.small, alt: ((_c = ds.settings) === null || _c === void 0 ? void 0 : _c.name) || ds.uid })),
            React.createElement("span", null, ((_d = ds.settings) === null || _d === void 0 ? void 0 : _d.name) || ds.uid)));
    });
    return React.createElement("div", { className: styles.dsContainer }, displayDs);
}
const getStyles = (theme) => ({
    dsImage: css({
        label: 'ds-image',
        width: '16px',
        marginRight: '3px',
    }),
    dsContainer: css({
        display: 'flex',
        flexDirection: 'row',
        fontSize: theme.typography.bodySmall.fontSize,
        gap: '10px',
        marginBottom: '10px',
        justifyContent: 'flex-end',
    }),
});
//# sourceMappingURL=DataSourcesInfo.js.map