import { screen, within } from '@testing-library/react';
import { render } from 'test/test-utils';

import { locationService } from '@grafana/runtime';

import { DataSourcesButton, renderDrilldownTitle } from './DataSourcesButton';

// The real picker asks the data source service for its list. This stand-in shows what the modal gives it, and a click
// on it chooses a data source.
jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    // The test render replaces locationService for every test, so a copy taken here would go stale.
    get locationService() {
      return actual.locationService;
    },
    DataSourcePicker: ({
      inputId,
      type,
      current,
      onChange,
    }: {
      inputId: string;
      type: string[];
      current: string | null;
      onChange: (dataSource: { uid: string }) => void;
    }) => (
      <button id={inputId} data-types={type.join(',')} onClick={() => onChange({ uid: `picked-${inputId}` })}>
        {current ?? 'none'}
      </button>
    ),
  };
});

const renderButton = (url = '/drilldown?var-ds-metrics=prom&var-ds-sql=orders') =>
  render(<DataSourcesButton />, { historyOptions: { initialEntries: [url] } });

const openModal = async (user: ReturnType<typeof renderButton>['user']) => {
  await user.click(screen.getByRole('button', { name: 'Data sources' }));
  return screen.findByRole('dialog');
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DataSourcesButton', () => {
  it('opens a modal with a picker for every signal, starting from the choices in the URL', async () => {
    const { user } = renderButton();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const dialog = await openModal(user);

    const choices = ['Metrics', 'Logs', 'Traces', 'Profiles', 'Knowledge graph', 'SQL'].map((label) =>
      within(dialog).getByLabelText(label)
    );
    expect(choices.map((choice) => choice.textContent)).toEqual(['prom', 'none', 'none', 'none', 'none', 'orders']);
    expect(choices[0]).toHaveAttribute('data-types', 'prometheus');
    expect(choices[5]).toHaveAttribute('data-types', 'mysql,grafana-postgresql-datasource,mssql');
  });

  it('writes every changed choice to the URL in one update when Apply is pressed', async () => {
    const { user } = renderButton();
    const partial = jest.spyOn(locationService, 'partial');
    const dialog = await openModal(user);

    await user.click(within(dialog).getByLabelText('Metrics'));
    await user.click(within(dialog).getByLabelText('Logs'));
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));

    expect(partial).toHaveBeenCalledTimes(1);
    expect(partial).toHaveBeenCalledWith(
      {
        'var-ds-metrics': 'picked-drilldown-data-source-metrics',
        'var-ds-logs': 'picked-drilldown-data-source-logs',
      },
      undefined
    );
    expect(locationService.getSearchObject()).toMatchObject({
      'var-ds-metrics': 'picked-drilldown-data-source-metrics',
      'var-ds-logs': 'picked-drilldown-data-source-logs',
      'var-ds-sql': 'orders',
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('leaves the URL alone when Cancel is pressed', async () => {
    const { user } = renderButton();
    const partial = jest.spyOn(locationService, 'partial');
    const dialog = await openModal(user);

    await user.click(within(dialog).getByLabelText('Metrics'));
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(partial).not.toHaveBeenCalled();
    expect(locationService.getSearchObject()).toMatchObject({ 'var-ds-metrics': 'prom' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('forgets what was picked when the modal is closed without Apply', async () => {
    const { user } = renderButton();
    const dialog = await openModal(user);
    await user.click(within(dialog).getByLabelText('Metrics'));
    expect(within(dialog).getByLabelText('Metrics')).toHaveTextContent('picked-drilldown-data-source-metrics');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    const reopened = await openModal(user);

    expect(within(reopened).getByLabelText('Metrics')).toHaveTextContent('prom');
  });

  it('keeps Apply disabled until a choice changes', async () => {
    const { user } = renderButton();
    const dialog = await openModal(user);
    expect(within(dialog).getByRole('button', { name: 'Apply' })).toBeDisabled();

    await user.click(within(dialog).getByLabelText('Logs'));

    expect(within(dialog).getByRole('button', { name: 'Apply' })).toBeEnabled();
  });

  it('does not count choosing the data source that is already in the URL as a change', async () => {
    const { user } = renderButton('/drilldown?var-ds-metrics=picked-drilldown-data-source-metrics');
    const dialog = await openModal(user);

    await user.click(within(dialog).getByLabelText('Metrics'));

    expect(within(dialog).getByRole('button', { name: 'Apply' })).toBeDisabled();
  });
});

describe('renderDrilldownTitle', () => {
  it('draws the heading with the data sources button beside it', () => {
    render(<>{renderDrilldownTitle('Drilldown')}</>);

    expect(screen.getByRole('heading', { level: 1, name: 'Drilldown' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Data sources' })).toBeInTheDocument();
  });
});
