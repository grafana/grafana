import { useLocation } from 'react-router-dom-v5-compat';

import { type RuleFormValues } from '../types/rule-form';
import { createPanelAlertRuleNavigation } from '../utils/navigation';

import { AlertRuleDrawerForm } from './AlertRuleDrawerForm';

interface Props {
  prefill?: Partial<RuleFormValues>;
  /**
   * Defaults to true. Provided automatically by the legacy ModalsContextProvider when
   * mounted via `ShowModalReactEvent`.
   */
  isOpen?: boolean;
  /**
   * Provided automatically by the legacy ModalsContextProvider when mounted via
   * `ShowModalReactEvent`. Scenes callers can pass their own.
   */
  onDismiss?: () => void;
}

export function PanelAlertRuleDrawer({ prefill, isOpen = true, onDismiss }: Props) {
  const location = useLocation();

  // AlertRuleDrawerForm always passes the live form values to onContinueInAlerting, so the
  // getFormValues fallback inside createPanelAlertRuleNavigation is never invoked from this caller.
  // Passing a noop makes the dead branch explicit.
  const { onContinueInAlertingFromDrawer } = createPanelAlertRuleNavigation(() => Promise.resolve(undefined), location);

  return (
    <AlertRuleDrawerForm
      isOpen={isOpen}
      onClose={() => onDismiss?.()}
      onContinueInAlerting={onContinueInAlertingFromDrawer}
      prefill={prefill}
    />
  );
}
