import { prettyDOM, render, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { byRole } from 'testing-library-selector';

import { Button } from '@grafana/ui';

import { TestProvider } from '../../../../../../test/helpers/TestProvider';
import * as grafanaApp from '../../components/receivers/grafanaAppReceivers/grafanaApp';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import { AmRootRouteForm } from './EditDefaultPolicyForm';

const ui = {
  timingOptionsBtn: byRole('button', { name: /Timing options/ }),
  groupWaitInput: byRole('textbox', { name: /Group wait/ }),
};

const useGetGrafanaReceiverTypeCheckerMock = jest.spyOn(grafanaApp, 'useGetGrafanaReceiverTypeChecker');
useGetGrafanaReceiverTypeCheckerMock.mockReturnValue(() => undefined);

describe('EditDefaultPolicyForm', function () {
  it('should allow using prometheus duration in timing options', async function () {
    const user = userEvent.setup();

    render(
      <AmRootRouteForm
        alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME}
        actionButtons={<Button type="submit">Update default policy</Button>}
        onSubmit={() => null}
        receivers={[{ value: 'email', label: 'Email' }]}
        route={{
          id: '0',
          group_wait: '',
          group_interval: '',
          repeat_interval: '',
          receiver: 'email',
          group_by: ['alertname'],
        }}
      />,
      { wrapper: TestProvider }
    );

    await user.click(ui.timingOptionsBtn.get());

    prettyDOM(ui.groupWaitInput.get());
    // await waitFor(() => expect(ui.groupWaitInput.get()).toHaveTextContent('1m30s'));
  });
});
