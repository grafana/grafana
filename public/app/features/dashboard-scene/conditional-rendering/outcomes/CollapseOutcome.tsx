import {
  DashboardRuleOutcomeCollapseKind,
  DashboardRuleOutcomeCollapseSpec,
} from '@grafana/schema/apis/dashboard.grafana.app/v3alpha0';
import { Field, RadioButtonGroup } from '@grafana/ui';

import { DashboardRuleOutcomeKindTypes, OutcomeEditorProps, OutcomeRegistryItem } from './outcomeRegistry';

function CollapseEditor({ spec, onChange }: OutcomeEditorProps<DashboardRuleOutcomeCollapseSpec>) {
  return (
    <Field label="Action">
      <RadioButtonGroup
        options={[
          { label: 'Collapse row', value: true },
          { label: 'Expand row', value: false },
        ]}
        value={spec.collapse}
        onChange={(v) => onChange({ ...spec, collapse: v })}
      />
    </Field>
  );
}

/**
 * Collapse outcome: collapses or expands the target row.
 * Only meaningful for RowItem targets. When conditions are met the row is
 * collapsed; when conditions stop being met the row reverts to its original
 * collapsed state.
 */
export const collapseOutcome: OutcomeRegistryItem<DashboardRuleOutcomeCollapseSpec> = {
  id: 'DashboardRuleOutcomeCollapse',
  name: 'Collapse row',
  description: 'Collapse or expand the target row',
  targetKinds: ['row'],

  createDefaultSpec(): DashboardRuleOutcomeCollapseSpec {
    return { collapse: true };
  },

  specFromKind(kind: DashboardRuleOutcomeKindTypes): DashboardRuleOutcomeCollapseSpec {
    const collapseKind = kind as DashboardRuleOutcomeCollapseKind;
    return collapseKind.spec;
  },

  specToKind(spec: DashboardRuleOutcomeCollapseSpec): DashboardRuleOutcomeKindTypes {
    return {
      kind: 'DashboardRuleOutcomeCollapse',
      spec,
    };
  },

  Editor: CollapseEditor,
};
