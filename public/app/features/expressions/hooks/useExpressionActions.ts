import { useState, useCallback } from 'react';

import { IconName } from '@grafana/data';

export interface ActionButtonConfig {
  label: string;
  tooltip: string;
  icon: IconName;
  onClick: () => void;
}

export function useExpressionActions() {
  const [actionButton, setActionButton] = useState<ActionButtonConfig | null>(null);

  const setActionButtonStable = useCallback((config: ActionButtonConfig | null) => {
    setActionButton(config);
  }, []);

  const clearActionButton = useCallback(() => {
    setActionButton(null);
  }, []);

  return {
    actionButton,
    setActionButton: setActionButtonStable,
    clearActionButton,
  };
}
