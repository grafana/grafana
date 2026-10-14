import { TOKEN_KEYS, type TokenDefinition, sharedDefinitions } from './tokens';

const alertOnlyDefinitions: TokenDefinition[] = [
  {
    key: TOKEN_KEYS.state,
    description: 'Alert state: firing, pending, recovering or normal.',
    example: 'state:firing',
  },
  {
    key: TOKEN_KEYS.dashboard,
    description: 'Dashboard the rule is linked to (canonical value is the dashboard UID).',
    example: 'dashboard:dash-uid',
  },
  {
    key: TOKEN_KEYS.panelId,
    description: 'Panel the rule is linked to. Panel IDs are dashboard-local; pair with dashboard:.',
    example: 'panelId:4',
  },
  {
    key: TOKEN_KEYS.contactPoint,
    description: 'Direct contact point (mutually exclusive with policy:).',
    example: 'contactPoint:on-call',
  },
  {
    key: TOKEN_KEYS.policy,
    description: 'Named notification policy. The reserved value "default" is not searchable yet.',
    example: 'policy:default',
  },
  {
    key: TOKEN_KEYS.paused,
    description: 'Whether the rule is paused (true/false).',
    example: 'paused:true',
  },
];

export const alertTokens: TokenDefinition[] = [...sharedDefinitions, ...alertOnlyDefinitions];
