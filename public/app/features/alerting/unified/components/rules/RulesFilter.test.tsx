import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';
import { byLabelText, byRole } from 'testing-library-selector';

import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { mockSearchApi, setupMswServer } from 'app/features/alerting/unified/mockApi';

import * as analytics from '../../Analytics';
import { MockDataSourceSrv } from '../../mocks';
import { setupPluginsExtensionsHook } from '../../testSetup/plugins';

import RulesFilter from './RulesFilter';

const server = setupMswServer();
jest.spyOn(analytics, 'logInfo');

jest.mock('./MultipleDataSourcePicker', () => {
  const original = jest.requireActual('./MultipleDataSourcePicker');
  return {
    ...original,
    MultipleDataSourcePicker: () => <></>,
  };
});

setDataSourceSrv(new MockDataSourceSrv({}));

setupPluginsExtensionsHook();

const ui = {
  stateFilter: {
    firing: byRole('radio', { name: 'Firing' }),
    normal: byRole('radio', { name: 'Normal' }),
  },
  ruleType: {
    alert: byRole('radio', { name: 'Alert' }),
  },
  health: {
    ok: byRole('radio', { name: 'Ok' }),
  },
  searchInput: byLabelText('Search'),
};

beforeEach(() => {
  locationService.replace({ search: '' });
  mockSearchApi(server).search([]);
});

describe('RulesFilter', () => {
  it('Should apply state filter to the search input', async () => {
    const user = userEvent.setup();

    render(<RulesFilter />, { wrapper: TestProvider });

    await user.click(ui.stateFilter.firing.get());

    expect(ui.searchInput.get()).toHaveValue('state:firing');
  });

  it('Should apply multiple UI-based filters to the search input', async () => {
    const user = userEvent.setup();

    render(<RulesFilter />, { wrapper: TestProvider });

    await user.click(ui.health.ok.get());
    await user.click(ui.ruleType.alert.get());
    await user.click(ui.stateFilter.normal.get());

    expect(ui.searchInput.get()).toHaveValue('health:ok type:alerting state:inactive');
  });

  it('Should combine UI filters and typed expressions', async () => {
    const user = userEvent.setup();

    render(<RulesFilter />, { wrapper: TestProvider });

    await user.type(ui.searchInput.get(), 'cpu{Enter}');
    await user.click(ui.health.ok.get());
    await user.type(ui.searchInput.get(), ' usage');

    expect(ui.searchInput.get()).toHaveValue('cpu health:ok usage');
  });
});

describe('Analytics', () => {
  it('Sends log info when clicking alert state filters', async () => {
    render(<RulesFilter />, { wrapper: TestProvider });

    const button = screen.getByText('Pending');

    await userEvent.click(button);

    expect(analytics.logInfo).toHaveBeenCalledWith(analytics.LogMessages.clickingAlertStateFilters);
  });
});
