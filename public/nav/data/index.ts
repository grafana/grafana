import { dashboardGuy } from './dashboard';
import { oncallGuy } from './oncall';
import { platformGuy } from './platform';
import { type NavPersonaConfig } from './types';

// Keyed by the value used in the `nav-persona` query string parameter,
// e.g. `?nav-persona=platform-guy`.
export const NAV_PERSONA_CONFIGS: Record<string, NavPersonaConfig> = {
  'platform': platformGuy,
  'dashboard': dashboardGuy,
  'oncall': oncallGuy,
};

export function getNavPersonaConfig(personaId: string | null | undefined): NavPersonaConfig | undefined {
  if (!personaId) {
    return undefined;
  }
  return NAV_PERSONA_CONFIGS[personaId];
}

export { type NavPersonaConfig };
