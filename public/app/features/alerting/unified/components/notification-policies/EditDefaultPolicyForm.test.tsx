import { noop } from 'lodash';
import { render } from 'test/test-utils';
import { byRole } from 'testing-library-selector';

import { Button } from '@grafana/ui';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { grantUserPermissions } from 'app/features/alerting/unified/mocks';
import { AlertmanagerProvider } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { AccessControlAction } from 'app/types/accessControl';

import { RouteWithID } from '../../../../../plugins/datasource/alertmanager/types';
import { FormAmRoute } from '../../types/amroutes';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { AmRootRouteForm } from './EditDefaultPolicyForm';

const ui = {
  error: byRole('alert'),
  timingOptionsBtn: byRole('button', { name: /Timing options/ }),
  submitBtn: byRole('button', { name: /Update default policy/ }),
  groupWaitInput: byRole('textbox', { name: /Group wait/ }),
  groupIntervalInput: byRole('textbox', { name: /Group interval/ }),
  repeatIntervalInput: byRole('textbox', { name: /Repeat interval/ }),
};
setupMswServer();
// TODO Default and Notification policy form should be unified so we don't need to maintain two almost identical forms
describe('EditDefaultPolicyForm', function () {
  beforeEach(() => {
    grantUserPermissions([
      AccessControlAction.AlertingNotificationsRead,
      AccessControlAction.AlertingNotificationsWrite,
    ]);
  });
  describe('Timing options', function () {
    it('should render prometheus duration strings in form inputs', async function () {
      const { user } = renderRouteForm({
        id: '0',
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
      const onSubmit = jest.fn();
      const { user } = renderRouteForm(
        {
          id: '0',
          receiver: 'default',
        },
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

  it('should show an error if repeat interval is lower than group interval', async function () {
    const onSubmit = jest.fn();
    const { user } = renderRouteForm(
      {
        id: '0',
        receiver: 'default',
      },
      onSubmit
    );

    await user.click(ui.timingOptionsBtn.get());

    await user.type(ui.groupWaitInput.get(), '5m25s');
    await user.type(ui.groupIntervalInput.get(), '35m40s');
    await user.type(ui.repeatIntervalInput.get(), '30m');

    await user.click(ui.submitBtn.get());

    expect(ui.error.getAll()).toHaveLength(1);
    expect(ui.error.get()).toHaveTextContent('Repeat interval should be higher or equal to Group interval');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should allow resetting existing timing options', async function () {
    const onSubmit = jest.fn();
    const { user } = renderRouteForm(
      {
        id: '0',
        receiver: 'default',
        group_wait: '1m30s',
        group_interval: '2d4h30m35s',
        repeat_interval: '1w2d6h',
      },
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

function renderRouteForm(route: RouteWithID, onSubmit: (route: Partial<FormAmRoute>) => void = noop) {
  return render(
    <AlertmanagerProvider accessType="instance">
      <AmRootRouteForm
        alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME}
        actionButtons={<Button type="submit">Update default policy</Button>}
        onSubmit={onSubmit}
        route={route}
      />
    </AlertmanagerProvider>
  );
}
