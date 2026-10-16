import type { ComponentType } from 'react';

import { AssistantNavOnboarding } from './AssistantNavOnboarding';

export const pluginNavFallbacks: Record<string, ComponentType> = {
  'grafana-assistant-app': AssistantNavOnboarding,
};
