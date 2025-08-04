import { Route, Routes } from 'react-router-dom-v5-compat';
import { render } from 'test/test-utils';
import { byRole, byTestId, byText } from 'testing-library-selector';

import { selectors } from '@grafana/e2e-selectors';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';
import RuleEditor from 'app/features/alerting/unified/rule-editor/RuleEditor';

export enum GrafanaRuleFormStep {
  Query = 2,
  FolderLabels = 3,
  Evaluation = 4,
  Notification = 5,
}

export const ui = {
  loadingIndicator: byText('Loading rule...'),
  manualRestoreBanner: byText(/restoring rule manually/i),
  formSteps: {
    folderLabels: byTestId(selectors.components.AlertRules.step(GrafanaRuleFormStep.FolderLabels.toString())),
    evaluation: byTestId(selectors.components.AlertRules.step(GrafanaRuleFormStep.Evaluation.toString())),
    notification: byTestId(selectors.components.AlertRules.step(GrafanaRuleFormStep.Notification.toString())),
  },
  inputs: {
    name: byRole('textbox', { name: 'name' }),
    metric: byRole('textbox', { name: 'metric' }),
    targetDatasource: byTestId('target-data-source'),
    alertType: byTestId('alert-type-picker'),
    dataSource: byTestId(selectors.components.DataSourcePicker.inputV2),
    folder: byTestId('folder-picker'),
    folderContainer: byTestId(selectors.components.FolderPicker.containerV2),
    namespace: byTestId('namespace-picker'),
    group: byTestId('group-picker'),
    pendingPeriod: byRole('textbox', { name: /^pending period/i }),
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
    save: byTestId('save-rule'),
    addAnnotation: byRole('button', { name: /Add info/ }),
    addLabel: byRole('button', { name: /Add label/ }),
    preview: byRole('button', { name: /^Preview$/ }),
  },
};
export function renderRuleEditor(
  identifier?: string,
  recording?: 'recording' | 'grafana-recording',
  restoreFrom?: string
) {
  const isManualRestore = Boolean(restoreFrom);
  const restoreFromEncoded = restoreFrom ? encodeURIComponent(restoreFrom) : '';
  const newAlertRuleRoute =
    `/alerting/new/${recording ?? 'alerting'}` +
    (isManualRestore ? `?isManualRestore=true&defaults=${restoreFromEncoded}` : '');
  const initialEntries = [identifier ? `/alerting/${identifier}/edit` : newAlertRuleRoute];
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
        initialEntries: initialEntries,
      },
    }
  );
}
