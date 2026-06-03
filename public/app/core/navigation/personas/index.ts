import { type NavLayoutConfig } from '../types';

import admin from './admin.json';
import alertingOwner from './alerting-owner.json';
import dashboardBuilder from './dashboard-builder.json';
import kubernetesPlatform from './kubernetes-platform.json';
import minimal from './minimal.json';
import observabilitySre from './observability-sre.json';

export interface NavPersona {
  id: string;
  label: string;
  description: string;
  layout: NavLayoutConfig;
}

const personaLayouts: Record<string, NavLayoutConfig> = {
  'dashboard-builder': dashboardBuilder as NavLayoutConfig,
  'observability-sre': observabilitySre as NavLayoutConfig,
  'kubernetes-platform': kubernetesPlatform as NavLayoutConfig,
  'alerting-owner': alertingOwner as NavLayoutConfig,
  admin: admin as NavLayoutConfig,
  minimal: minimal as NavLayoutConfig,
};

export const NAV_PERSONAS: NavPersona[] = [
  {
    id: 'minimal',
    label: 'Getting started',
    description: 'Home, dashboards, and explore',
    layout: personaLayouts.minimal,
  },
  {
    id: 'dashboard-builder',
    label: 'Dashboard builder',
    description: 'Dashboards, starred items, and explore',
    layout: personaLayouts['dashboard-builder'],
  },
  {
    id: 'observability-sre',
    label: 'Observability / SRE',
    description: 'Explore, drilldown, alerting, and infrastructure',
    layout: personaLayouts['observability-sre'],
  },
  {
    id: 'kubernetes-platform',
    label: 'Kubernetes / platform',
    description: 'Infrastructure, connections, and apps',
    layout: personaLayouts['kubernetes-platform'],
  },
  {
    id: 'alerting-owner',
    label: 'Alerting owner',
    description: 'Alerting and incidents',
    layout: personaLayouts['alerting-owner'],
  },
  {
    id: 'admin',
    label: 'Administrator',
    description: 'Plugins, access, and connections',
    layout: personaLayouts.admin,
  },
];

export function getPersonaLayout(personaId: string): NavLayoutConfig | undefined {
  const layout = personaLayouts[personaId];
  if (!layout) {
    return undefined;
  }
  return {
    ...layout,
    pinnedIds: [...(layout.pinnedIds ?? [])],
    order: [...(layout.order ?? [])],
  };
}
