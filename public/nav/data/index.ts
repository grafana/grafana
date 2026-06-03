import { dashboardGuy } from './dashboard-guy';
import { oncallGuy } from './oncall-guy';
import { platformGuy } from './platform-guy';
import { type NavPersonaConfig } from './types';

// Keyed by the value used in the `nav-persona` query string parameter,
// e.g. `?nav-persona=platform-guy`.
export const NAV_PERSONA_CONFIGS: Record<string, NavPersonaConfig> = {
  'platform-guy': platformGuy,
  'dashboard-guy': dashboardGuy,
  'oncall-guy': oncallGuy,
};

export function getNavPersonaConfig(personaId: string | null | undefined): NavPersonaConfig | undefined {
  if (!personaId) {
    return undefined;
  }
  return NAV_PERSONA_CONFIGS[personaId];
}

export { type NavPersonaConfig };
