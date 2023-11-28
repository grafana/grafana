import { components } from '@reactour/tour';
import React from 'react';
import { useTheme2 } from '@grafana/ui';
const Badge = ({ children }) => {
    const theme = useTheme2();
    return (React.createElement(components.Badge, { styles: {
            badge: (base) => (Object.assign(Object.assign({}, base), { background: theme.colors.primary.main, fontFamily: theme.typography.fontFamily, fontSize: '0.8em' })),
        } }, children));
};
export default Badge;
//# sourceMappingURL=Badge.js.map