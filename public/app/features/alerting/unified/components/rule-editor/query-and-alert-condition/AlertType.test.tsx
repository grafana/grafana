import { render } from '@testing-library/react';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Provider } from 'react-redux';
import { byText } from 'testing-library-selector';

import { contextSrv } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types';

import { AlertType } from './AlertType';

const ui = {
  ruleTypePicker: {
    grafanaManagedButton: byText('Grafana managed alert'),
    mimirOrLokiButton: byText('Mimir or Loki alert'),
    mimirOrLokiRecordingButton: byText('Mimir or Loki recording rule'),
  },
};

const FormProviderWrapper = ({ children }: React.PropsWithChildren<{}>) => {
  const methods = useForm({});
  return <FormProvider {...methods}>{children}</FormProvider>;
};

function renderAlertTypeStep() {
  const store = configureStore();

  render(
    <Provider store={store}>
      <AlertType editingExistingRule={false} />
    </Provider>,
    { wrapper: FormProviderWrapper }
  );
}

describe('RuleTypePicker', () => {
  describe('RBAC', () => {
    it('Should display grafana, mimir alert and mimir recording buttons when user has rule create and write permissions', async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockImplementation((action) => {
        return [AccessControlAction.AlertingRuleCreate, AccessControlAction.AlertingRuleExternalWrite].includes(
          action as AccessControlAction
        );
      });

      renderAlertTypeStep();

      expect(ui.ruleTypePicker.grafanaManagedButton.get()).toBeInTheDocument();
      expect(ui.ruleTypePicker.mimirOrLokiButton.get()).toBeInTheDocument();
      expect(ui.ruleTypePicker.mimirOrLokiRecordingButton.get()).toBeInTheDocument();
    });

    it('Should hide grafana button when user does not have rule create permission', () => {
      jest.spyOn(contextSrv, 'hasPermission').mockImplementation((action) => {
        return [AccessControlAction.AlertingRuleExternalWrite].includes(action as AccessControlAction);
      });

      renderAlertTypeStep();

      expect(ui.ruleTypePicker.grafanaManagedButton.query()).not.toBeInTheDocument();
      expect(ui.ruleTypePicker.mimirOrLokiButton.get()).toBeInTheDocument();
      expect(ui.ruleTypePicker.mimirOrLokiRecordingButton.get()).toBeInTheDocument();
    });

    it('Should hide mimir alert and mimir recording when user does not have rule external write permission', () => {
      jest.spyOn(contextSrv, 'hasPermission').mockImplementation((action) => {
        return [AccessControlAction.AlertingRuleCreate].includes(action as AccessControlAction);
      });

      renderAlertTypeStep();

      expect(ui.ruleTypePicker.grafanaManagedButton.get()).toBeInTheDocument();
      expect(ui.ruleTypePicker.mimirOrLokiButton.query()).not.toBeInTheDocument();
      expect(ui.ruleTypePicker.mimirOrLokiRecordingButton.query()).not.toBeInTheDocument();
    });
  });
});
