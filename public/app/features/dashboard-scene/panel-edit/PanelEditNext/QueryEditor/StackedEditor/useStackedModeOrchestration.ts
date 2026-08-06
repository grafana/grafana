import { useCallback, useMemo, useState } from 'react';

import { QueryEditorType } from '../../constants';
import { type StackedEditorItem, type StackedEditorState } from '../QueryEditorContext';

interface UseStackedModeOrchestrationArgs {
  /**
   * Moves the active card by id, leaving the bulk selection alone. Scrolling the stack activates
   * whichever card comes into view, which is navigation rather than a selection change — so it
   * must not disturb checkboxes the user ticked.
   */
  activateItem: (queryRefId: string | null, transformationId: string | null) => void;
  /** True while the alerts view owns the content pane, which leaves no room for the stack. */
  isAlertView: boolean;
}

/**
 * Owns the stacked-mode state machine: the user's on/off choice and the scroll-to-selection bridge.
 *
 * `enabled` is derived rather than stored so that views which take over the content pane can
 * pre-empt the stack without discarding the user's choice — switching to alerts and back leaves
 * them where they were.
 *
 * Lives outside `QueryEditorContextWrapper` so the wrapper doesn't carry the stacked-only
 * plumbing inline. The wrapper composes this hook and exposes the returned `stackedMode`
 * on its context.
 */
export function useStackedModeOrchestration({
  activateItem,
  isAlertView,
}: UseStackedModeOrchestrationArgs): StackedEditorState {
  const [prefersStackedMode, setPrefersStackedMode] = useState(false);

  const enter = useCallback(() => setPrefersStackedMode(true), []);
  const exit = useCallback(() => setPrefersStackedMode(false), []);

  const syncActiveItem = useCallback(
    (item: StackedEditorItem) => {
      if (item.type === QueryEditorType.Transformation) {
        activateItem(null, item.id);
      } else {
        activateItem(item.id, null);
      }
    },
    [activateItem]
  );

  return useMemo<StackedEditorState>(
    () => ({
      enabled: prefersStackedMode && !isAlertView,
      enter,
      exit,
      syncActiveItem,
    }),
    [prefersStackedMode, isAlertView, enter, exit, syncActiveItem]
  );
}
