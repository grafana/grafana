import { type SceneComponentProps, SceneObjectBase, type SceneObjectState } from '@grafana/scenes';
import { PanelAlertRuleDrawer } from 'app/features/alerting/unified/components/PanelAlertRuleDrawer';
import { type RuleFormValues } from 'app/features/alerting/unified/types/rule-form';

import { getDashboardSceneFor } from '../utils/utils';

export interface NewAlertRuleDrawerState extends SceneObjectState {
  prefill?: Partial<RuleFormValues>;
}

export class NewAlertRuleDrawer extends SceneObjectBase<NewAlertRuleDrawerState> {
  public onClose = () => {
    getDashboardSceneFor(this).closeModal();
  };

  static Component = ({ model }: SceneComponentProps<NewAlertRuleDrawer>) => {
    const { prefill } = model.useState();

    return <PanelAlertRuleDrawer prefill={prefill} onDismiss={model.onClose} />;
  };
}
