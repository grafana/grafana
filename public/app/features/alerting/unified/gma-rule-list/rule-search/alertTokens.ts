import { TOKEN_KEYS, type TokenDefinition, sharedDefinitions } from './tokens';

const alertOnlyDefinitions: TokenDefinition[] = [
  {
    key: TOKEN_KEYS.state,
    description: 'Alert state. Visible but filtering is not deployed yet.',
    example: 'state:firing',
    availability: 'pending',
  },
  {
    key: TOKEN_KEYS.dashboard,
    description: 'Dashboard the rule is linked to (canonical value is the dashboard UID).',
    example: 'dashboard:dash-uid',
    availability: 'available',
  },
  {
    key: TOKEN_KEYS.panelId,
    description: 'Panel the rule is linked to. Panel IDs are dashboard-local; pair with dashboard:.',
    example: 'panelId:4',
    availability: 'available',
  },
  {
    key: TOKEN_KEYS.contactPoint,
    description: 'Direct contact point (mutually exclusive with policy:).',
    example: 'contactPoint:on-call',
    availability: 'available',
  },
  {
    key: TOKEN_KEYS.policy,
    description: 'Named notification policy, or the reserved value "default".',
    example: 'policy:default',
    availability: 'available',
  },
  {
    key: TOKEN_KEYS.paused,
    description: 'Whether the rule is paused (true/false).',
    example: 'paused:true',
    availability: 'available',
  },
];

export const alertTokens: TokenDefinition[] = [...sharedDefinitions, ...alertOnlyDefinitions];
