import { useEffect, useRef } from 'react';

import { SceneVariableValueChangedEvent, type SceneVariable } from '@grafana/scenes';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';

import { DashboardInteractions } from '../utils/interactions';

export function useTrackDashboardVariableValueChange(variable: SceneVariable) {
  const userInitiatedRef = useRef(false);
  const isMobile = !useMediaQueryMinWidth('sm');

  useEffect(() => {
    const subscription = variable.subscribeToEvent(SceneVariableValueChangedEvent, (event) => {
      if (!isMobile || event.payload !== variable || !userInitiatedRef.current) {
        return;
      }

      userInitiatedRef.current = false;

      DashboardInteractions.variableValueChanged({
        type: variable.state.type,
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isMobile, variable]);

  return {
    markUserInitiated: () => {
      if (!isMobile) {
        return;
      }
      userInitiatedRef.current = true;
    },
  };
}
