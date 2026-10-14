import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { act, render, screen } from 'test/test-utils';

import {
  ContactPointFactory,
  ListReceiverApiResponseFactory,
  listReceiverHandler,
  simpleRoutingTreesListScenario,
} from '@grafana/alerting/testing';
import { type DataSourceInstanceSettings } from '@grafana/data';
import { type DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';
import { mockComboboxRect } from '@grafana/test-utils';

import { setupMswServer } from '../../mockApi';
import { type Criteria, createEmptyCriteria } from '../rule-search/criteria';
import { getInteractiveControls, tabSequence } from '../rule-search/filterSidebarTestUtils';

import { AlertRulesFilterSidebar } from './AlertRulesFilterSidebar';

// The pickers here are the real ones, not stand-ins: this file is about the names and keyboard
// behavior they give the sidebar, which a stand-in would hide.
mockComboboxRect();

window.HTMLElement.prototype.scrollIntoView = function () {};

const server = setupMswServer();

const FOLDER_PARENTS_URL = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:name/parents';

function dataSource(uid: string, name: string) {
  return { uid, name, meta: { id: 'prometheus', info: { logos: { small: '' } } } } as DataSourceInstanceSettings;
}

async function renderSidebar(criteria: Criteria = createEmptyCriteria()) {
  const onChange = jest.fn();
  const view = render(
    <AlertRulesFilterSidebar criteria={criteria} onChange={onChange} onClear={jest.fn()} hasActiveFilters={true} />
  );
  // The data source picker loads its implementation asynchronously.
  await screen.findByRole('combobox', { name: 'Select a data source' });
  return { ...view, onChange, user: userEvent.setup() };
}

function focus(element: HTMLElement) {
  act(() => element.focus());
}

describe('AlertRulesFilterSidebar accessibility', () => {
  beforeEach(() => {
    const dataSources = [dataSource('ds-1', 'Prometheus'), dataSource('ds-2', 'Loki')];
    setDataSourceSrv({
      getList: () => dataSources,
      getInstanceSettings: (ref: string) => dataSources.find((ds) => ds.uid === ref),
    } as unknown as DataSourceSrv);
    server.use(
      http.get(FOLDER_PARENTS_URL, ({ params }) =>
        HttpResponse.json({ items: [{ name: params.name, title: 'Team Alerts' }] })
      ),
      listReceiverHandler(
        ListReceiverApiResponseFactory.build({
          items: [
            ContactPointFactory.build({ metadata: { uid: 'cp-1' }, spec: { title: 'on-call', integrations: [] } }),
          ],
        })
      ),
      ...simpleRoutingTreesListScenario
    );
  });

  afterEach(() => {
    setDataSourceSrv({ getList: () => [], getInstanceSettings: () => undefined } as unknown as DataSourceSrv);
  });

  // ACC-6
  it('shows one labelled field group per filter, in the order of the filter definitions', async () => {
    await renderSidebar();

    const fieldNames = [
      'Rule name',
      'Labels',
      'Folder',
      'Query data source',
      'Plugin rules',
      'Dashboard',
      'Panel ID',
      'Contact point',
      'Notification policy',
      'Paused',
      'Alert state',
      'Health',
    ];

    expect(screen.getAllByRole('group')).toEqual(fieldNames.map((name) => screen.getByRole('group', { name })));
  });

  // ACC-6
  it.each([
    ['textbox', 'Rule name'],
    ['button', 'Add label filter'],
    ['button', 'Folder'],
    ['combobox', 'Select a data source'],
    ['switch', 'Hide plugin rules'],
    ['combobox', 'Dashboard'],
    ['spinbutton', 'Panel ID'],
    ['combobox', 'Contact point'],
    ['combobox', 'Notification policy'],
    ['switch', 'Default policy'],
    ['combobox', 'Paused'],
    ['combobox', 'Alert state'],
    ['combobox', 'Health'],
    ['button', 'Clear filters'],
  ])('ACC-6: the %s named "%s" is found by its accessible name', async (role, name) => {
    await renderSidebar();

    expect(screen.getByRole(role, { name })).toBeInTheDocument();
  });

  // ACC-6
  it('names the controls of an applied label, folder and data source', async () => {
    await renderSidebar({
      ...createEmptyCriteria(),
      labels: [{ key: 'team', operator: 'equal', value: 'api' }],
      namespaces: ['folder-1'],
      dataSourceUids: ['ds-1'],
    });

    expect(screen.getByRole('textbox', { name: 'Label key' })).toHaveValue('team');
    expect(screen.getByRole('radiogroup', { name: 'Label operator' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Label value' })).toHaveValue('api');
    expect(screen.getByRole('button', { name: 'Remove label filter' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Remove Team Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Prometheus' })).toBeInTheDocument();
  });

  // ACC-6
  it('leaves no interactive element in the sidebar without an accessible name', async () => {
    const { container } = await renderSidebar({
      ...createEmptyCriteria(),
      labels: [{ key: 'team', operator: 'equal', value: 'api' }],
      namespaces: ['folder-1'],
      dataSourceUids: ['ds-1'],
    });
    await screen.findByRole('button', { name: 'Remove Team Alerts' });

    const controls = getInteractiveControls(container);

    expect(controls.length).toBeGreaterThanOrEqual(20);
    controls.forEach((control) => expect(control).toHaveAccessibleName());
  });

  // ACC-6
  it('reaches every enabled control with Tab, and skips Panel ID until a dashboard is selected', async () => {
    const { user } = await renderSidebar();
    const enabledControls = [
      screen.getByRole('textbox', { name: 'Rule name' }),
      screen.getByRole('button', { name: 'Add label filter' }),
      screen.getByRole('button', { name: 'Folder' }),
      screen.getByRole('combobox', { name: 'Select a data source' }),
      screen.getByRole('switch', { name: 'Hide plugin rules' }),
      screen.getByRole('combobox', { name: 'Dashboard' }),
      screen.getByRole('combobox', { name: 'Contact point' }),
      screen.getByRole('combobox', { name: 'Notification policy' }),
      screen.getByRole('combobox', { name: 'Paused' }),
      screen.getByRole('combobox', { name: 'Alert state' }),
      screen.getByRole('combobox', { name: 'Health' }),
    ];

    const visited = await tabSequence(user, screen.getByRole('button', { name: 'Clear filters' }), 14);

    enabledControls.forEach((control) => expect(visited).toContain(control));
    expect(screen.getByRole('spinbutton', { name: 'Panel ID' })).toBeDisabled();
    expect(visited).not.toContain(screen.getByRole('spinbutton', { name: 'Panel ID' }));
    expect(visited).not.toContain(screen.getByRole('switch', { name: 'Default policy' }));
  });

  // ACC-6
  it('reaches an applied label row and the remove buttons of selected values with Tab', async () => {
    const { user } = await renderSidebar({
      ...createEmptyCriteria(),
      labels: [{ key: 'team', operator: 'equal', value: 'api' }],
      namespaces: ['folder-1'],
      dataSourceUids: ['ds-1'],
    });
    const removeFolder = await screen.findByRole('button', { name: 'Remove Team Alerts' });

    const visited = await tabSequence(user, screen.getByRole('button', { name: 'Clear filters' }), 12);

    [
      screen.getByRole('textbox', { name: 'Label key' }),
      screen.getByRole('textbox', { name: 'Label value' }),
      screen.getByRole('button', { name: 'Remove label filter' }),
      removeFolder,
      screen.getByRole('button', { name: 'Remove Prometheus' }),
    ].forEach((control) => expect(visited).toContain(control));
  });

  // ACC-6
  it('toggles Hide plugin rules with the Space key', async () => {
    const { user, onChange } = await renderSidebar();

    focus(screen.getByRole('switch', { name: 'Hide plugin rules' }));
    await user.keyboard(' ');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ hidePluginRules: true }));
  });

  // ACC-6
  it.each([
    { name: 'Paused', option: 'Not paused', arrowPresses: 2, expected: { paused: 'false' } },
    { name: 'Alert state', option: 'Firing', arrowPresses: 1, expected: { state: 'firing' } },
    { name: 'Health', option: 'No data', arrowPresses: 2, expected: { health: 'nodata' } },
  ])('selects $option in the $name combobox with the keyboard', async ({ name, option, arrowPresses, expected }) => {
    const { user, onChange } = await renderSidebar();

    focus(screen.getByRole('combobox', { name }));
    await user.keyboard('{ArrowDown}');
    await screen.findByRole('option', { name: option });
    await user.keyboard('{ArrowDown}'.repeat(arrowPresses));
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining(expected));
  });

  // ACC-6
  it('selects a query data source with the keyboard', async () => {
    const { user, onChange } = await renderSidebar();

    focus(screen.getByRole('combobox', { name: 'Select a data source' }));
    await user.keyboard('Loki');
    await screen.findByText('Loki');
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ dataSourceUids: ['ds-2'] }));
  });

  // ACC-6
  it('adds a label row with Enter on Add label filter and moves to naming it', async () => {
    const { user } = await renderSidebar();

    focus(screen.getByRole('button', { name: 'Add label filter' }));
    await user.keyboard('{Enter}');

    expect(screen.getByRole('textbox', { name: 'Label key' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add label filter' })).toBeDisabled();
  });
});
