import { useMemo } from 'react';
import { Annotation } from './constants';
import { makeDashboardLink, makePanelLink } from './misc';
export function usePanelAndDashboardIds(annotations) {
    var _a, _b;
    return {
        dashboardUID: (_a = annotations.find(([key]) => key === Annotation.dashboardUID)) === null || _a === void 0 ? void 0 : _a[1],
        panelId: (_b = annotations.find(([key]) => key === Annotation.panelID)) === null || _b === void 0 ? void 0 : _b[1],
    };
}
/**
 * Removes annotations with empty or whitespace values
 */
export function useCleanAnnotations(annotations) {
    return useMemo(() => {
        return Object.entries(annotations || {}).filter(([_, value]) => !!value.trim());
    }, [annotations]);
}
export function useAnnotationLinks(annotations) {
    const links = new Map();
    const { panelId, dashboardUID } = usePanelAndDashboardIds(annotations);
    if (dashboardUID) {
        links.set(Annotation.dashboardUID, makeDashboardLink(dashboardUID));
    }
    if (dashboardUID && panelId) {
        links.set(Annotation.panelID, makePanelLink(dashboardUID, panelId));
    }
    return links;
}
//# sourceMappingURL=annotations.js.map