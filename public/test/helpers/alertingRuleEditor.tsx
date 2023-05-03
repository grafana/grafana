import { render } from '@testing-library/react';
import React from 'react';
import { Route } from 'react-router-dom';
import { byRole, byTestId } from 'testing-library-selector';

import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import RuleEditor from 'app/features/alerting/unified/RuleEditor';

import { TestProvider } from './TestProvider';

export const ui = {
  inputs: {
    name: byRole('textbox', { name: /rule name name for the alert rule\./i }),
    alertType: byTestId('alert-type-picker'),
    dataSource: byTestId('datasource-picker'),
    folder: byTestId('folder-picker'),
    folderContainer: byTestId(selectors.components.FolderPicker.containerV2),
    namespace: byTestId('namespace-picker'),
    group: byTestId('group-picker'),
    annotationKey: (idx: number) => byTestId(`annotation-key-${idx}`),
    annotationValue: (idx: number) => byTestId(`annotation-value-${idx}`),
    labelKey: (idx: number) => byTestId(`label-key-${idx}`),
    labelValue: (idx: number) => byTestId(`label-value-${idx}`),
    expr: byTestId('expr'),
  },
  buttons: {
    save: byRole('button', { name: 'Save' }),
    addAnnotation: byRole('button', { name: /Add info/ }),
    addLabel: byRole('button', { name: /Add label/ }),
    // alert type buttons
    grafanaManagedAlert: byRole('button', { name: /Grafana managed/ }),
    lotexAlert: byRole('button', { name: /Mimir or Loki alert/ }),
    lotexRecordingRule: byRole('button', { name: /Mimir or Loki recording rule/ }),
  },
};

export function renderRuleEditor(identifier?: string) {
  locationService.push(identifier ? `/alerting/${identifier}/edit` : `/alerting/new`);

  return render(
    <TestProvider>
      <Route path={['/alerting/new', '/alerting/:id/edit']} component={RuleEditor} />
    </TestProvider>
  );
}
