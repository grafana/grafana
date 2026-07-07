import { type ScopedVars } from '@grafana/data';

import { usePanelContext } from '../QueryEditorContext';
import { getPanelScopedVars } from '../utils';

/** React-context counterpart of {@link getPanelScopedVars}, reading the panel from QueryEditor context. */
export function usePanelScopedVars(): ScopedVars {
  const { panel } = usePanelContext();
  return getPanelScopedVars(panel);
}
