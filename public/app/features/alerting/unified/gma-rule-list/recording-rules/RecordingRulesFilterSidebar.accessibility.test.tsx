import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { act, render, screen, within } from 'test/test-utils';

import { type DataSourceInstanceSettings } from '@grafana/data';
import { type DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';
import { mockComboboxRect } from '@grafana/test-utils';

import { setupMswServer } from '../../mockApi';
import { type Criteria, createEmptyCriteria } from '../rule-search/criteria';
import { getInteractiveControls, tabSequence } from '../rule-search/filterSidebarTestUtils';

import { RecordingRulesFilterSidebar } from './RecordingRulesFilterSidebar';

// Real pickers on purpose: stand-ins would hide their names and keyboard behavior.
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
    <RecordingRulesFilterSidebar criteria={criteria} onChange={onChange} onClear={jest.fn()} hasActiveFilters={true} />
  );
  // The data source pickers load their implementation asynchronously.
  await screen.findAllByRole('combobox', { name: 'Select a data source' });
  return { ...view, onChange, user: userEvent.setup() };
}

function focus(element: HTMLElement) {
  act(() => element.focus());
}

function getTargetDataSourcePicker() {
  return within(screen.getByRole('group', { name: 'Target data source' })).getByRole('combobox', {
    name: 'Select a data source',
  });
}

describe('RecordingRulesFilterSidebar accessibility', () => {
  beforeEach(() => {
    const dataSources = [dataSource('ds-1', 'Prometheus'), dataSource('ds-2', 'Loki')];
    setDataSourceSrv({
      getList: () => dataSources,
      getInstanceSettings: (ref: string) => dataSources.find((ds) => ds.uid === ref),
    } as unknown as DataSourceSrv);
    server.use(
      http.get(FOLDER_PARENTS_URL, ({ params }) =>
        HttpResponse.json({ items: [{ name: params.name, title: 'Team Alerts' }] })
      )
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
      'Recorded metric',
      'Target data source',
      'Health',
    ];

    expect(screen.getAllByRole('group')).toEqual(fieldNames.map((name) => screen.getByRole('group', { name })));
  });

  // ACC-6
  it.each([
    ['textbox', 'Rule name'],
    ['button', 'Add label filter'],
    ['button', 'Folder'],
    ['switch', 'Hide plugin rules'],
    ['textbox', 'Recorded metric'],
    ['combobox', 'Health'],
    ['button', 'Clear filters'],
  ])('ACC-6: the %s named "%s" is found by its accessible name', async (role, name) => {
    await renderSidebar();

    expect(screen.getByRole(role, { name })).toBeInTheDocument();
  });

  // ACC-6
  it('gives the query and target data source pickers distinct ids and tells them apart by their field groups', async () => {
    await renderSidebar();

    const queryPicker = within(screen.getByRole('group', { name: 'Query data source' })).getByRole('combobox', {
      name: 'Select a data source',
    });

    expect(queryPicker.id).not.toBe(getTargetDataSourcePicker().id);
  });

  // ACC-6
  it('names the controls of an applied label, folder, data source and target data source', async () => {
    await renderSidebar({
      ...createEmptyCriteria(),
      labels: [{ key: 'team', operator: 'equal', value: 'api' }],
      namespaces: ['folder-1'],
      dataSourceUids: ['ds-1'],
      targetDataSourceUid: 'ds-2',
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
      targetDataSourceUid: 'ds-2',
    });
    await screen.findByRole('button', { name: 'Remove Team Alerts' });

    const controls = getInteractiveControls(container);

    expect(controls.length).toBeGreaterThanOrEqual(14);
    controls.forEach((control) => expect(control).toHaveAccessibleName());
  });

  // ACC-6
  it('reaches every control with Tab', async () => {
    const { user } = await renderSidebar();
    const controls = [
      screen.getByRole('textbox', { name: 'Rule name' }),
      screen.getByRole('button', { name: 'Add label filter' }),
      screen.getByRole('button', { name: 'Folder' }),
      within(screen.getByRole('group', { name: 'Query data source' })).getByRole('combobox'),
      screen.getByRole('switch', { name: 'Hide plugin rules' }),
      screen.getByRole('textbox', { name: 'Recorded metric' }),
      getTargetDataSourcePicker(),
      screen.getByRole('combobox', { name: 'Health' }),
    ];

    const visited = await tabSequence(user, screen.getByRole('button', { name: 'Clear filters' }), 10);

    controls.forEach((control) => expect(visited).toContain(control));
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
  it('selects a health in the Health combobox with the keyboard', async () => {
    const { user, onChange } = await renderSidebar();

    focus(screen.getByRole('combobox', { name: 'Health' }));
    await user.keyboard('{ArrowDown}');
    await screen.findByRole('option', { name: 'No data' });
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ health: 'nodata' }));
  });

  // ACC-6
  it('selects a target data source with the keyboard', async () => {
    const { user, onChange } = await renderSidebar();

    focus(getTargetDataSourcePicker());
    await user.keyboard('Loki');
    await screen.findByText('Loki');
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ targetDataSourceUid: 'ds-2' }));
  });
});
