import { useCallback, useState } from 'react';

import { store } from '@grafana/data';

const STORAGE_KEY = 'grafana.alerting.rulesAPIV2.showDependencyArrows';

export function useShowDependencyArrowsPref(): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => store.getBool(STORAGE_KEY, true));

  const update = useCallback((next: boolean) => {
    store.set(STORAGE_KEY, String(next));
    setValue(next);
  }, []);

  return [value, update];
}
