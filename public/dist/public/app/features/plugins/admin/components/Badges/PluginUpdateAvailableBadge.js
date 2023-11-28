import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
export function PluginUpdateAvailableBadge({ plugin }) {
    const styles = useStyles2(getStyles);
    return React.createElement("p", { className: styles.hasUpdate }, "Update available!");
}
export const getStyles = (theme) => {
    return {
        hasUpdate: css `
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.bodySmall.fontSize};
      margin-bottom: 0;
    `,
    };
};
//# sourceMappingURL=PluginUpdateAvailableBadge.js.map