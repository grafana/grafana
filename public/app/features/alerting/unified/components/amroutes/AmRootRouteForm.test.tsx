import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { noop } from 'lodash';
import React from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { byRole } from 'testing-library-selector';

import { Route } from 'app/plugins/datasource/alertmanager/types';
import { configureStore } from 'app/store/configureStore';

import * as grafanaApp from '../../components/receivers/grafanaAppReceivers/grafanaApp';
import { FormAmRoute } from '../../types/amroutes';
import { amRouteToFormAmRoute } from '../../utils/amroutes';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { AmRouteReceiver } from '../receivers/grafanaAppReceivers/types';

import { AmRootRouteForm } from './AmRootRouteForm';

const ui = {
  error: byRole('alert'),
  timingOptionsBtn: byRole('button', { name: /Timing options/ }),
  submitBtn: byRole('button', { name: /Save/ }),
  groupWaitInput: byRole('textbox', { name: /Group wait/ }),
  groupIntervalInput: byRole('textbox', { name: /Group interval/ }),
  repeatIntervalInput: byRole('textbox', { name: /Repeat interval/ }),
};

const useGetGrafanaReceiverTypeCheckerMock = jest.spyOn(grafanaApp, 'useGetGrafanaReceiverTypeChecker');
useGetGrafanaReceiverTypeCheckerMock.mockReturnValue(() => undefined);

// TODO Default and Notification policy form should be unified so we don't need to maintain two almost identical forms
describe('AmRootRouteForm', function () {
  describe('Timing options', function () {
    it('should render prometheus duration strings in form inputs', async function () {
      const user = userEvent.setup();

      renderRouteForm({
        group_wait: '1m30s',
        group_interval: '2d4h30m35s',
        repeat_interval: '1w2d6h',
      });

      await user.click(ui.timingOptionsBtn.get());
      expect(ui.groupWaitInput.get()).toHaveValue('1m30s');
      expect(ui.groupIntervalInput.get()).toHaveValue('2d4h30m35s');
      expect(ui.repeatIntervalInput.get()).toHaveValue('1w2d6h');
    });
    it('should allow submitting valid prometheus duration strings', async function () {
      const user = userEvent.setup();

      const onSubmit = jest.fn();
      renderRouteForm(
        {
          receiver: 'default',
        },
        [{ value: 'default', label: 'Default' }],
        onSubmit
      );

      await user.click(ui.timingOptionsBtn.get());

      await user.type(ui.groupWaitInput.get(), '5m25s');
      await user.type(ui.groupIntervalInput.get(), '35m40s');
      await user.type(ui.repeatIntervalInput.get(), '4h30m');

      await user.click(ui.submitBtn.get());

      expect(ui.error.queryAll()).toHaveLength(0);
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining<Partial<FormAmRoute>>({
          groupWaitValue: '5m25s',
          groupIntervalValue: '35m40s',
          repeatIntervalValue: '4h30m',
        }),
        expect.anything()
      );
    });
  });

  it('should allow resetting existing timing options', async function () {
    const user = userEvent.setup();

    const onSubmit = jest.fn();
    renderRouteForm(
      {
        receiver: 'default',
        group_wait: '1m30s',
        group_interval: '2d4h30m35s',
        repeat_interval: '1w2d6h',
      },
      [{ value: 'default', label: 'Default' }],
      onSubmit
    );

    await user.click(ui.timingOptionsBtn.get());
    await user.clear(ui.groupWaitInput.get());
    await user.clear(ui.groupIntervalInput.get());
    await user.clear(ui.repeatIntervalInput.get());

    await user.click(ui.submitBtn.get());

    expect(ui.error.queryAll()).toHaveLength(0);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining<Partial<FormAmRoute>>({
        groupWaitValue: '',
        groupIntervalValue: '',
        repeatIntervalValue: '',
      }),
      expect.anything()
    );
  });
});

function renderRouteForm(
  route: Route,
  receivers: AmRouteReceiver[] = [],
  onSubmit: (route: Partial<FormAmRoute>) => void = noop
) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={configureStore()}>
      <MemoryRouter>{children}</MemoryRouter>
    </Provider>
  );
  const [formAmRoute] = amRouteToFormAmRoute(route);

  render(
    <AmRootRouteForm
      alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME}
      onSave={onSubmit}
      receivers={receivers}
      routes={formAmRoute}
      onCancel={noop}
    />,
    { wrapper: Wrapper }
  );
}
