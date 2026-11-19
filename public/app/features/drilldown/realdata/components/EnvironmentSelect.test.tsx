import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { locationService } from '@grafana/runtime';
import { mockComboboxRect } from '@grafana/test-utils';

import { setOverview } from '../liveScenario';
import { emptyOverview } from '../testFixtures';

import { EnvironmentSelect } from './EnvironmentSelect';

mockComboboxRect();

const withEnvironments = (environment: string[]) =>
  setOverview({ ...emptyOverview, scopeValues: { ...emptyOverview.scopeValues, environment } });

const search = () => locationService.getSearchObject();

afterEach(() => {
  setOverview(emptyOverview);
});

describe('EnvironmentSelect', () => {
  it('shows nothing when the traces hold no environment', () => {
    render(<EnvironmentSelect />);

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('shows All until an environment is chosen', () => {
    withEnvironments(['dev', 'prod']);

    render(<EnvironmentSelect />);

    expect(screen.getByRole('combobox', { name: 'Environment' })).toHaveValue('All');
  });

  it('shows the environment the URL names, even one the traces no longer hold', () => {
    withEnvironments(['dev']);

    render(<EnvironmentSelect />, { historyOptions: { initialEntries: ['/drilldown?var-environment=staging'] } });

    expect(screen.getByRole('combobox', { name: 'Environment' })).toHaveValue('staging');
  });

  it('writes the environment picked to the URL', async () => {
    withEnvironments(['dev', 'prod']);
    const { user } = render(<EnvironmentSelect />);

    await user.click(screen.getByRole('combobox', { name: 'Environment' }));
    await user.click(await screen.findByRole('option', { name: 'prod' }));

    expect(search()).toMatchObject({ 'var-environment': 'prod' });
  });

  it('takes the environment out of the URL when All is picked', async () => {
    withEnvironments(['dev', 'prod']);
    const { user } = render(<EnvironmentSelect />, {
      historyOptions: { initialEntries: ['/drilldown?var-environment=prod'] },
    });

    await user.click(screen.getByRole('combobox', { name: 'Environment' }));
    await user.click(await screen.findByRole('option', { name: 'All' }));

    expect(search()).not.toHaveProperty('var-environment');
  });
});
