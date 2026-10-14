import { TOKEN_KEYS, type TokenDefinition, sharedDefinitions } from './tokens';

const recordingOnlyDefinitions: TokenDefinition[] = [
  {
    key: TOKEN_KEYS.metric,
    description: 'Recorded metric name (exact match).',
    example: 'metric:cpu_usage',
  },
  {
    key: TOKEN_KEYS.targetDatasource,
    description: 'Data source the recorded metric is written to (canonical value is the UID).',
    example: 'targetDatasource:ds-uid',
  },
];

export const recordingTokens: TokenDefinition[] = [...sharedDefinitions, ...recordingOnlyDefinitions];
