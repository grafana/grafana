import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router';

import { OrgRole } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { wrapWithGrafanaContextMock } from 'app/percona/shared/helpers/testUtils';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import AlertRuleFromTemplate from './AlertRuleFromTemplate';

jest.mock('../AlertRuleTemplate/AlertRuleTemplate.service');

const setup = (role = OrgRole.Admin, isAuthorized = true) => {
  config.bootData.user.orgRole = role;

  return render(
    <Provider
      store={configureStore({
        percona: {
          user: { isAuthorized },
          settings: { loading: false, result: { isConnectedToPortal: true, alertingEnabled: true } },
        },
      } as StoreState)}
    >
      {wrapWithGrafanaContextMock(
        <Router history={locationService.getHistory()}>
          <AlertRuleFromTemplate />
        </Router>
      )}
    </Provider>
  );
};

describe('AlertRuleFromTemplate::', () => {
  it('should be accessible to admin', async () => {
    setup();

    await waitFor(() => expect(screen.queryByTestId('unauthorized')).not.toBeInTheDocument());
  });

  it('should be accessible to editor', async () => {
    setup(OrgRole.Editor, false);

    await waitFor(() => expect(screen.queryByTestId('unauthorized')).not.toBeInTheDocument());
  });

  it('should not be accessible to viewer', async () => {
    setup(OrgRole.Viewer, false);

    expect(screen.queryByTestId('unauthorized')).toBeInTheDocument();
  });
});
