import { debounce, type DebouncedFunc } from 'lodash';

import { type VizPanel } from '@grafana/scenes';
import { type OverrideChange } from 'app/features/dashboard/components/PanelEditor/getFieldOverrideElements';

import { trackPanelSettingChange } from '../utils/trackPanelSettingChange';

const EDIT_DEBOUNCE_MS = 1000;

export interface OverrideChangeReporter {
  report: (change: OverrideChange) => void;
  /** Sends edits still waiting for their debounce, for example when the options pane unmounts. */
  flush: () => void;
}

/**
 * Reports override changes for a panel. Matcher and property editors can call onChange on every keystroke, so
 * those edits are debounced per override and property; adding and removing are reported straight away.
 */
export function createOverrideChangeReporter(panel: VizPanel): OverrideChangeReporter {
  const pendingEdits = new Map<string, DebouncedFunc<(send: () => void) => void>>();

  const report = (change: OverrideChange) => {
    const send = () =>
      trackPanelSettingChange(panel, change.item, undefined, {
        matcher_id: change.matcherId,
        ...('propertyId' in change && { property_id: change.propertyId }),
      });

    if (change.item !== 'change_override_matcher' && change.item !== 'change_override_property') {
      send();
      return;
    }

    const key = `${change.item}:${change.overrideIndex}:${'propertyId' in change ? change.propertyId : ''}`;
    let pending = pendingEdits.get(key);
    if (!pending) {
      pending = debounce((latestSend: () => void) => latestSend(), EDIT_DEBOUNCE_MS);
      pendingEdits.set(key, pending);
    }
    pending(send);
  };

  const flush = () => {
    pendingEdits.forEach((pending) => pending.flush());
  };

  return { report, flush };
}
