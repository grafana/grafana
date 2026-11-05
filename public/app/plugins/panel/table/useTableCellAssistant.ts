import { useCallback } from 'react';

import { type DataFrame, type Field, type PanelProps } from '@grafana/data';
import { useFlagTableRefresh, useFlagTableRefreshNewFeatures } from '@grafana/runtime/internal';
import { useAddToAssistant } from 'app/core/assistant/useAddToAssistant';

import { buildTableCellAssistantContext } from './buildTableCellAssistantContext';

export function useTableCellAssistant({
  id,
  title,
  timeRange,
  replaceVariables,
}: Pick<PanelProps, 'id' | 'title' | 'timeRange' | 'replaceVariables'>) {
  const { isAvailable, addToAssistant } = useAddToAssistant({ origin: 'grafana/table-cell' });
  const refreshEnabled = useFlagTableRefresh();
  const newFeaturesEnabled = useFlagTableRefreshNewFeatures();
  const enabled = refreshEnabled && newFeaturesEnabled && isAvailable;

  const addCell = useCallback(
    (frame: DataFrame, field: Field, rowIndex: number) => {
      if (!enabled) {
        return;
      }

      addToAssistant(
        buildTableCellAssistantContext({
          frame,
          field,
          rowIndex,
          panelId: id,
          panelTitle: title,
          timeRange,
          replaceVariables,
        })
      );
    },
    [enabled, addToAssistant, id, title, timeRange, replaceVariables]
  );

  return enabled ? addCell : undefined;
}
