import { type ReactNode, useMemo } from 'react';

import {
  useEnrichmentAbilityStates,
  useExternalRuleAbilityStates,
  useFolderBulkActionAbilityStates,
  useRuleAbilityStates,
} from '../hooks/useAbilities';
import { type AbilityState, type AbilityStates, type Action } from '../hooks/useAbilities.types';
import {
  useAllAlertmanagerAbilityStates,
  useAllExternalAlertmanagerAbilityStates,
} from '../hooks/useAlertmanagerAbilities';

// ── Internal helpers ──────────────────────────────────────────────────────────

type RenderProp<T> = (state: T) => ReactNode;
type ChildrenOrRenderProp<T> = ReactNode | RenderProp<T>;

function isRenderProp<T>(children: ChildrenOrRenderProp<T>): children is RenderProp<T> {
  return typeof children === 'function';
}

/**
 * Resolves AbilityStates for the given actions by merging all six action-domain
 * hooks. This covers Grafana rules, external rules, alertmanager actions,
 * external alertmanager actions, folder bulk actions, and enrichment actions.
 *
 * Note: this hook always calls all six domain hooks unconditionally (rules of hooks).
 * The result is memoised so repeated renders with the same action set are cheap.
 */
function useAbilityStatesForActions(actions: Action[]): AbilityStates<Action> {
  const amStates = useAllAlertmanagerAbilityStates();
  const extAmStates = useAllExternalAlertmanagerAbilityStates();
  const ruleStates = useRuleAbilityStates();
  const extRuleStates = useExternalRuleAbilityStates();
  const folderBulkStates = useFolderBulkActionAbilityStates();
  const enrichmentStates = useEnrichmentAbilityStates();

  return useMemo(() => {
    const merged: Partial<AbilityStates<Action>> = {
      ...amStates,
      ...extAmStates,
      ...ruleStates,
      ...extRuleStates,
      ...folderBulkStates,
      ...enrichmentStates,
    };

    const fallback: AbilityState = { granted: false, supported: false, allowed: false, loading: false };

    return actions.reduce<AbilityStates<Action>>((acc, action) => {
      acc[action] = merged[action] ?? fallback;
      return acc;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    }, {} as AbilityStates<Action>);
  }, [amStates, extAmStates, ruleStates, extRuleStates, folderBulkStates, enrichmentStates, actions]);
}

// ── <Ability> — single-action gate ───────────────────────────────────────────

interface AbilityProps {
  action: Action;
  children: ChildrenOrRenderProp<AbilityState>;
}

/**
 * Renders children only when the single `action` is granted.
 *
 * @example
 * // Simple gate
 * <Ability action={RuleAction.Create}>
 *   <NewRuleButton />
 * </Ability>
 *
 * @example
 * // Render-prop for richer UI
 * <Ability action={RuleAction.Update}>
 *   {({ supported, allowed, loading }) =>
 *     loading ? <Spinner /> :
 *     !supported ? null :
 *     !allowed ? <Button disabled tooltip="No permission" /> :
 *     <Button />
 *   }
 * </Ability>
 */
export function Ability({ action, children }: AbilityProps) {
  const states = useAbilityStatesForActions([action]);
  const state = states[action];

  if (isRenderProp<AbilityState>(children)) {
    return <>{children(state)}</>;
  }

  return state.granted ? <>{children}</> : null;
}

// ── <AbilityAny> — render if ANY action is granted ───────────────────────────

interface AbilityAnyProps {
  actions: Action[];
  children: ChildrenOrRenderProp<AbilityState[]>;
}

/**
 * Renders children when **any** of the listed actions is granted.
 *
 * @example
 * <AbilityAny actions={[RuleAction.Update, RuleAction.Delete]}>
 *   <ActionMenu />
 * </AbilityAny>
 *
 * @example
 * // Render-prop — receives AbilityState[] in the same order as `actions`
 * <AbilityAny actions={[RuleAction.Update, RuleAction.Delete]}>
 *   {(states) => states.some(s => s.loading) ? <Spinner /> : <Menu />}
 * </AbilityAny>
 */
export function AbilityAny({ actions, children }: AbilityAnyProps) {
  const states = useAbilityStatesForActions(actions);
  const stateList = actions.map((a) => states[a]);

  if (isRenderProp<AbilityState[]>(children)) {
    return <>{children(stateList)}</>;
  }

  return stateList.some((s) => s.granted) ? <>{children}</> : null;
}

// ── <AbilityEvery> — render only if ALL actions are granted ──────────────────

interface AbilityEveryProps {
  actions: Action[];
  children: ChildrenOrRenderProp<AbilityState[]>;
}

/**
 * Renders children only when **all** of the listed actions are granted.
 *
 * @example
 * <AbilityEvery actions={[RuleAction.Update, ExternalRuleAction.UpdateAlertRule]}>
 *   <BulkEditButton />
 * </AbilityEvery>
 */
export function AbilityEvery({ actions, children }: AbilityEveryProps) {
  const states = useAbilityStatesForActions(actions);
  const stateList = actions.map((a) => states[a]);

  if (isRenderProp<AbilityState[]>(children)) {
    return <>{children(stateList)}</>;
  }

  return stateList.every((s) => s.granted) ? <>{children}</> : null;
}
