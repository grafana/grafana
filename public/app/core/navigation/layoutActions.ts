import { type NavLayoutConfig } from './types';
import { getPersonaLayout } from './personas';

export function applyPersonaLayout(personaId: string): NavLayoutConfig | undefined {
  return getPersonaLayout(personaId);
}

export function setExpandedOverflow(layout: NavLayoutConfig, expanded: boolean): NavLayoutConfig {
  return {
    ...layout,
    expandedOverflow: expanded,
  };
}
