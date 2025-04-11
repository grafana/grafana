import { useMemo } from 'react';

import { usePluginContext } from '@grafana/data';

import { getFixedT, t } from './initializeI18n';

export function useTranslate() {
  const context = usePluginContext();

  if (!context) {
    return t;
  }

  const { meta } = context;
  const pluginT = useMemo(() => getFixedT(meta.id), [meta.id]);
  return pluginT;
}
