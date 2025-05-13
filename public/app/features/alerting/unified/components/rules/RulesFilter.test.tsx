import { render, screen } from 'test/test-utils';
import { byLabelText, byRole } from 'testing-library-selector';

import { locationService } from '@grafana/runtime';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';

import * as analytics from '../../Analytics';
import { setupDataSources } from '../../testSetup/datasources';

import RulesFilter from './Filter/RulesFilter';

setupMswServer();
setupDataSources();

jest.spyOn(analytics, 'logInfo');

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

    await user.click(await ui.stateFilter.firing.find());

    expect(ui.searchInput.get()).toHaveValue('state:firing');
  });

  it('Should apply multiple UI-based filters to the search input', async () => {
    const { user } = render(<RulesFilter />);

    await user.click(await ui.health.ok.find());
    await user.click(ui.ruleType.alert.get());
    await user.click(ui.stateFilter.normal.get());

    expect(ui.searchInput.get()).toHaveValue('health:ok type:alerting state:inactive');
  });

  it('Should combine UI filters and typed expressions', async () => {
    const { user } = render(<RulesFilter />);

    await user.type(await ui.searchInput.find(), 'cpu{Enter}');
    await user.click(ui.health.ok.get());
    await user.type(ui.searchInput.get(), ' usage');

    expect(ui.searchInput.get()).toHaveValue('cpu health:ok usage');
  });
});

describe('Analytics', () => {
  it('Sends log info when clicking alert state filters', async () => {
    const { user } = render(<RulesFilter />);

    const button = await screen.findByText('Pending');

    await user.click(button);

    expect(analytics.logInfo).toHaveBeenCalledWith(analytics.LogMessages.clickingAlertStateFilters);
  });
});
