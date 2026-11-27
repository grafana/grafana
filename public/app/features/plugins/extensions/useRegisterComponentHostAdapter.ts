import { useEffect } from 'react';

import { type ComponentHostAdapter } from '@grafana/data';

import { useDescriptorState } from './ComponentDescriptorsContext';
import { log } from './logs/log';

export function useRegisterComponentHostAdapter(adapter: ComponentHostAdapter) {
  const { registry } = useDescriptorState();
  useEffect(() => {
    if (!registry) {
      return;
    }
    const dispose: Array<() => void> = [];
    for (const entry of registry.list()) {
      try {
        if (adapter.supports(entry)) {
          const unregister = adapter.register(entry);
          dispose.push(() => {
            try {
              unregister();
            } catch {
              log.error('Component host adapter cleanup failed', { componentId: entry.id });
            }
          });
        }
      } catch {
        log.error('Component host adapter registration failed', { componentId: entry.id });
      }
    }
    return () => dispose.forEach((unregister) => unregister());
  }, [registry, adapter]);
}
