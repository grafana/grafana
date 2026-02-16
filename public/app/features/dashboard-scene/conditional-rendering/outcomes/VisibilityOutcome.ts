import {
  DashboardRuleOutcomeVisibilityKind,
  DashboardRuleOutcomeVisibilitySpec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { DashboardRuleOutcomeKindTypes, OutcomeRegistryItem } from './outcomeRegistry';

/**
 * Visibility outcome: shows or hides the target element/layout item.
 * The apply/revert behavior is implemented by the rule engine (DashboardRule SceneObject)
 * which tracks active outcomes and exposes them to rendering hooks.
 */
export const visibilityOutcome: OutcomeRegistryItem<DashboardRuleOutcomeVisibilitySpec> = {
  id: 'DashboardRuleOutcomeVisibility',
  name: 'Visibility',
  description: 'Show or hide the target element',
  targetKinds: ['panel', 'row', 'tab'],

  createDefaultSpec(): DashboardRuleOutcomeVisibilitySpec {
    return { visibility: 'hide' };
  },

  specFromKind(kind: DashboardRuleOutcomeKindTypes): DashboardRuleOutcomeVisibilitySpec {
    const visibilityKind = kind as DashboardRuleOutcomeVisibilityKind;
    return visibilityKind.spec;
  },

  specToKind(spec: DashboardRuleOutcomeVisibilitySpec): DashboardRuleOutcomeKindTypes {
    return {
      kind: 'DashboardRuleOutcomeVisibility',
      spec,
    };
  },
};
