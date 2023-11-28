import React, { useContext } from 'react';
export const GrafanaContext = React.createContext(undefined);
export function useGrafana() {
    const context = useContext(GrafanaContext);
    if (!context) {
        throw new Error('No GrafanaContext found');
    }
    return context;
}
//# sourceMappingURL=GrafanaContext.js.map