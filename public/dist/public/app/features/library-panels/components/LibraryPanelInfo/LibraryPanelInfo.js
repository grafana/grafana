import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
export const LibraryPanelInformation = ({ panel, formatDate }) => {
    var _a, _b;
    const styles = useStyles2(getStyles);
    const meta = (_a = panel.libraryPanel) === null || _a === void 0 ? void 0 : _a.meta;
    if (!meta) {
        return null;
    }
    return (React.createElement("div", { className: styles.info },
        React.createElement("div", { className: styles.libraryPanelInfo },
            `Used on ${meta.connectedDashboards} `,
            meta.connectedDashboards === 1 ? 'dashboard' : 'dashboards'),
        React.createElement("div", { className: styles.libraryPanelInfo },
            "Last edited on ", (_b = formatDate === null || formatDate === void 0 ? void 0 : formatDate(meta.updated, 'L')) !== null && _b !== void 0 ? _b : meta.updated,
            " by",
            meta.updatedBy.avatarUrl && (React.createElement("img", { width: "22", height: "22", className: styles.userAvatar, src: meta.updatedBy.avatarUrl, alt: `Avatar for ${meta.updatedBy.name}` })),
            meta.updatedBy.name)));
};
const getStyles = (theme) => {
    return {
        info: css `
      line-height: 1;
    `,
        libraryPanelInfo: css `
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.bodySmall.fontSize};
    `,
        userAvatar: css `
      border-radius: ${theme.shape.radius.circle};
      box-sizing: content-box;
      width: 22px;
      height: 22px;
      padding-left: ${theme.spacing(1)};
      padding-right: ${theme.spacing(1)};
    `,
    };
};
//# sourceMappingURL=LibraryPanelInfo.js.map