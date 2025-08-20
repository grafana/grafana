import { render, screen } from 'test/test-utils';
import { byLabelText, byRole } from 'testing-library-selector';

import { locationService } from '@grafana/runtime';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';

import * as analytics from '../../Analytics';
import { setupPluginsExtensionsHook } from '../../testSetup/plugins';

import RulesFilter from './RulesFilter';

setupMswServer();
jest.spyOn(analytics, 'logInfo');

jest.mock('./MultipleDataSourcePicker', () => {
  const original = jest.requireActual('./MultipleDataSourcePicker');
  return {
    ...original,
    MultipleDataSourcePicker: () => null,
  };
});

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
});

describe('RulesFilter', () => {
  it('Should apply state filter to the search input', async () => {
    const { user } = render(<RulesFilter />);

    await user.click(ui.stateFilter.firing.get());

    expect(ui.searchInput.get()).toHaveValue('state:firing');
  });

  it('Should apply multiple UI-based filters to the search input', async () => {
    const { user } = render(<RulesFilter />);

    await user.click(ui.health.ok.get());
    await user.click(ui.ruleType.alert.get());
    await user.click(ui.stateFilter.normal.get());

    expect(ui.searchInput.get()).toHaveValue('health:ok type:alerting state:inactive');
  });

  it('Should combine UI filters and typed expressions', async () => {
    const { user } = render(<RulesFilter />);

    await user.type(ui.searchInput.get(), 'cpu{Enter}');
    await user.click(ui.health.ok.get());
    await user.type(ui.searchInput.get(), ' usage');

    expect(ui.searchInput.get()).toHaveValue('cpu health:ok usage');
  });
});

describe('Analytics', () => {
  it('Sends log info when clicking alert state filters', async () => {
    const { user } = render(<RulesFilter />);

    const button = screen.getByText('Pending');

    await user.click(button);

    expect(analytics.logInfo).toHaveBeenCalledWith(analytics.LogMessages.clickingAlertStateFilters);
  });
});
