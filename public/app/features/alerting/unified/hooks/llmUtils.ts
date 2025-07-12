import { useAsync } from 'react-use';

import { isLLMPluginEnabled } from 'app/features/dashboard/components/GenAI/utils';

export function useIsLLMPluginEnabled() {
  return useAsync(isLLMPluginEnabled);
}
