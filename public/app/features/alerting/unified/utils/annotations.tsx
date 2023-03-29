import { useMemo } from 'react';

import { Annotations } from 'app/types/unified-alerting-dto';

import { Annotation } from './constants';
import { makeDashboardLink, makePanelLink } from './misc';

export function usePanelAndDashboardIds(annotations: Array<[string, string]>): {
  dashboardUID?: string;
  panelId?: string;
} {
  return {
    dashboardUID: annotations.find(([key]) => key === Annotation.dashboardUID)?.[1],
    panelId: annotations.find(([key]) => key === Annotation.panelID)?.[1],
  };
}

/**
 * Removes annotations with empty or whitespace values
 */
export function useCleanAnnotations(annotations: Annotations): Array<[string, string]> {
  return useMemo(() => {
    return Object.entries(annotations || {}).filter(([_, value]) => !!value.trim());
  }, [annotations]);
}

export function useAnnotationLinks(annotations: Array<[string, string]>): Map<string, string> {
  const links = new Map<string, string>();

  const { panelId, dashboardUID } = usePanelAndDashboardIds(annotations);

  if (dashboardUID) {
    links.set(Annotation.dashboardUID, makeDashboardLink(dashboardUID));
  }
  if (dashboardUID && panelId) {
    links.set(Annotation.panelID, makePanelLink(dashboardUID, panelId));
  }

  return links;
}
