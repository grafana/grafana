import { useCallback } from 'react';

import { type DataFrame, type Field, type PanelProps } from '@grafana/data';
import { useFlagTableRefresh, useFlagTableRefreshNewFeatures } from '@grafana/runtime/internal';
import { useAddToAssistant } from 'app/core/assistant/useAddToAssistant';

import { buildTableFieldAssistantContext } from './buildTableFieldAssistantContext';

export function useTableFieldAssistant({
  id,
  title,
  timeRange,
  replaceVariables,
}: Pick<PanelProps, 'id' | 'title' | 'timeRange' | 'replaceVariables'>) {
  const { isAvailable, addToAssistant } = useAddToAssistant({ origin: 'grafana/table-field' });
  const refreshEnabled = useFlagTableRefresh();
  const newFeaturesEnabled = useFlagTableRefreshNewFeatures();
  const enabled = refreshEnabled && newFeaturesEnabled && isAvailable;

  const addField = useCallback(
    (frame: DataFrame, field: Field) => {
      if (!enabled) {
        return;
      }
      addToAssistant(
        buildTableFieldAssistantContext({ frame, field, panelId: id, panelTitle: title, timeRange, replaceVariables })
      );
    },
    [enabled, addToAssistant, id, title, timeRange, replaceVariables]
  );

  return enabled ? addField : undefined;
}
