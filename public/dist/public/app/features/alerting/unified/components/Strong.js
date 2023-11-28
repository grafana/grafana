import React from 'react';
import { useTheme2 } from '@grafana/ui';
const Strong = ({ children }) => {
    const theme = useTheme2();
    return React.createElement("strong", { style: { color: theme.colors.text.primary } }, children);
};
export { Strong };
//# sourceMappingURL=Strong.js.map