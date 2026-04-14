import { type ReactNode, useMemo } from 'react';

import {
  useAllAlertmanagerAbilities,
  useAllExternalAlertmanagerAbilities,
} from '../hooks/abilities/notificationAbilities';
import { useEnrichmentAbilities, useFolderBulkActionAbilities } from '../hooks/abilities/otherAbilities';
import { useExternalGlobalRuleAbilities, useGlobalRuleAbilities } from '../hooks/abilities/ruleAbilities';
import { type Abilities, type Ability, type Action, NotSupported } from '../hooks/abilities/types';

// ── Internal helpers ──────────────────────────────────────────────────────────

type RenderProp<T> = (state: T) => ReactNode;
type ChildrenOrRenderProp<T> = ReactNode | RenderProp<T>;

function isRenderProp<T>(children: ChildrenOrRenderProp<T>): children is RenderProp<T> {
  return typeof children === 'function';
}

/**
 * Resolves Abilities for the given actions by merging all six action-domain
 * hooks. This covers Grafana rules, external rules, alertmanager actions,
 * external alertmanager actions, folder bulk actions, and enrichment actions.
 *
 * Note: this hook always calls all six domain hooks unconditionally (rules of hooks).
 * The result is memoised so repeated renders with the same action set are cheap.
 */
function useAbilitiesForActions(actions: Action[]): Abilities<Action> {
  const amStates = useAllAlertmanagerAbilities();
  const extAmStates = useAllExternalAlertmanagerAbilities();
  const ruleStates = useGlobalRuleAbilities();
  const extRuleStates = useExternalGlobalRuleAbilities();
  const folderBulkStates = useFolderBulkActionAbilities();
  const enrichmentStates = useEnrichmentAbilities();

  return useMemo(() => {
    const merged: Partial<Abilities<Action>> = {
      ...amStates,
      ...extAmStates,
      ...ruleStates,
      ...extRuleStates,
      ...folderBulkStates,
      ...enrichmentStates,
    };

    return actions.reduce<Abilities<Action>>((acc, action) => {
      acc[action] = merged[action] ?? NotSupported;
      return acc;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    }, {} as Abilities<Action>);
  }, [amStates, extAmStates, ruleStates, extRuleStates, folderBulkStates, enrichmentStates, actions]);
}

// ── <Ability> — single-action gate ───────────────────────────────────────────

interface AbilityProps {
  action: Action;
  children: ChildrenOrRenderProp<Ability>;
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
export function AbilityGate({ action, children }: AbilityProps) {
  const states = useAbilitiesForActions([action]);
  const state = states[action];

  if (isRenderProp<Ability>(children)) {
    return <>{children(state)}</>;
  }

  return state.granted ? <>{children}</> : null;
}

// ── <AbilityAny> — render if ANY action is granted ───────────────────────────

interface AbilityAnyProps {
  actions: Action[];
  children: ChildrenOrRenderProp<Ability[]>;
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
 * // Render-prop — receives Ability[] in the same order as `actions`
 * <AbilityAny actions={[RuleAction.Update, RuleAction.Delete]}>
 *   {(states) => states.some(s => s.loading) ? <Spinner /> : <Menu />}
 * </AbilityAny>
 */
export function AbilityAny({ actions, children }: AbilityAnyProps) {
  const states = useAbilitiesForActions(actions);
  const stateList = actions.map((a) => states[a]);

  if (isRenderProp<Ability[]>(children)) {
    return <>{children(stateList)}</>;
  }

  return stateList.some((s) => s.granted) ? <>{children}</> : null;
}

// ── <AbilityEvery> — render only if ALL actions are granted ──────────────────

interface AbilityEveryProps {
  actions: Action[];
  children: ChildrenOrRenderProp<Ability[]>;
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
  const states = useAbilitiesForActions(actions);
  const stateList = actions.map((a) => states[a]);

  if (isRenderProp<Ability[]>(children)) {
    return <>{children(stateList)}</>;
  }

  return stateList.every((s) => s.granted) ? <>{children}</> : null;
}
