import { Route, Routes } from 'react-router-dom-v5-compat';
import { render } from 'test/test-utils';
import { byRole, byTestId, byText } from 'testing-library-selector';

import { selectors } from '@grafana/e2e-selectors';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import RuleEditor from 'app/features/alerting/unified/rule-editor/RuleEditor';

export enum GrafanaRuleFormStep {
  Query = 2,
  Notification = 5,
}

export const ui = {
  loadingIndicator: byText('Loading rule...'),
  inputs: {
    name: byRole('textbox', { name: 'name' }),
    metric: byRole('textbox', { name: 'metric' }),
    alertType: byTestId('alert-type-picker'),
    dataSource: byTestId(selectors.components.DataSourcePicker.inputV2),
    folder: byTestId('folder-picker'),
    folderContainer: byTestId(selectors.components.FolderPicker.containerV2),
    namespace: byTestId('namespace-picker'),
    group: byTestId('group-picker'),
    annotationKey: (idx: number) => byTestId(`annotation-key-${idx}`),
    annotationValue: (idx: number) => byTestId(`annotation-value-${idx}`),
    labelKey: (idx: number) => byTestId(`label-key-${idx}`),
    labelValue: (idx: number) => byTestId(`label-value-${idx}`),
    expr: byTestId('expr'),
    simplifiedRouting: {
      contactPointRouting: byRole('radio', { name: /select contact point/i }),
      contactPoint: byTestId('contact-point-picker'),
      routingOptions: byText(/muting, grouping and timings \(optional\)/i),
    },
    switchModeBasic: (stepNo: GrafanaRuleFormStep) =>
      byTestId(selectors.components.AlertRules.stepAdvancedModeSwitch(stepNo.toString())),
    switchModeAdvanced: (stepNo: GrafanaRuleFormStep) =>
      byTestId(selectors.components.AlertRules.stepAdvancedModeSwitch(stepNo.toString())),
  },
  buttons: {
    saveAndExit: byRole('button', { name: 'Save rule and exit' }),
    save: byRole('button', { name: 'Save rule' }),
    addAnnotation: byRole('button', { name: /Add info/ }),
    addLabel: byRole('button', { name: /Add label/ }),
    preview: byRole('button', { name: /^Preview$/ }),
  },
};
export function renderRuleEditor(identifier?: string, recording?: 'recording' | 'grafana-recording') {
  return render(
    <>
      <AppNotificationList />
      <Routes>
        <Route path={'/alerting/new/:type'} element={<RuleEditor />} />
        <Route path={'/alerting/:id/edit'} element={<RuleEditor />} />
      </Routes>
    </>,
    {
      historyOptions: {
        initialEntries: [identifier ? `/alerting/${identifier}/edit` : `/alerting/new/${recording ?? 'alerting'}`],
      },
    }
  );
}
