import { act, render, screen, within } from 'test/test-utils';

import { mockComboboxRect } from '@grafana/test-utils';

import { setupMswServer } from '../../mockApi';
import { mockDataSource } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';
import { DataSourceType } from '../../utils/datasource';
import { getInteractiveControls, tabSequence } from '../mocks/filterSidebarTestUtils';
import { mockFolderParents } from '../mocks/handlers';
import { type RuleSearchFilter, createEmptyFilter } from '../token-search/ruleSearchFilter';

import { RecordingRulesFilterSidebar } from './RecordingRulesFilterSidebar';

// Real pickers on purpose: stand-ins would hide their names and keyboard behavior.
mockComboboxRect();

window.HTMLElement.prototype.scrollIntoView = function () {};

setupMswServer();

async function renderSidebar(filter: RuleSearchFilter = createEmptyFilter()) {
  const onChange = jest.fn();
  const view = render(
    <RecordingRulesFilterSidebar filter={filter} onChange={onChange} onClear={jest.fn()} hasActiveFilters={true} />
  );
  // The data source pickers load their implementation asynchronously.
  await screen.findAllByRole('combobox', { name: 'Select a data source' });
  return { ...view, onChange };
}

function focus(element: HTMLElement) {
  act(() => element.focus());
}

function getTargetDataSourcePicker() {
  return within(screen.getByRole('group', { name: 'Target data source' })).getByRole('combobox', {
    name: 'Select a data source',
  });
}

describe('RecordingRulesFilterSidebar', () => {
  beforeEach(() => {
    setupDataSources(
      mockDataSource({ uid: 'ds-1', name: 'Prometheus', type: DataSourceType.Prometheus }, { metrics: true }),
      mockDataSource({ uid: 'ds-2', name: 'Loki', type: DataSourceType.Prometheus }, { metrics: true })
    );
    mockFolderParents({ 'folder-1': 'Team Alerts' });
  });

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

  it('gives the query and target data source pickers distinct ids and tells them apart by their field groups', async () => {
    await renderSidebar();

    const queryPicker = within(screen.getByRole('group', { name: 'Query data source' })).getByRole('combobox', {
      name: 'Select a data source',
    });

    expect(queryPicker.id).not.toBe(getTargetDataSourcePicker().id);
  });

  it('names the controls of an applied label, folder, data source and target data source', async () => {
    await renderSidebar({
      ...createEmptyFilter(),
      labels: [{ key: 'team', operator: 'equal', value: 'api' }],
      namespaces: ['folder-1'],
      dataSourceUids: ['ds-1'],
      targetDataSourceUid: 'ds-2',
    });

    expect(screen.getByRole('textbox', { name: 'Label key' })).toHaveValue('team');
    expect(screen.getByRole('combobox', { name: 'Label operator' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Label value' })).toHaveValue('api');
    expect(screen.getByRole('button', { name: 'Remove label filter' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Remove Team Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Prometheus' })).toBeInTheDocument();
  });

  it('leaves no interactive element in the sidebar without an accessible name', async () => {
    const { container } = await renderSidebar({
      ...createEmptyFilter(),
      labels: [{ key: 'team', operator: 'equal', value: 'api' }],
      namespaces: ['folder-1'],
      dataSourceUids: ['ds-1'],
      targetDataSourceUid: 'ds-2',
    });
    await screen.findByRole('button', { name: 'Remove Team Alerts' });

    const controls = getInteractiveControls(container);

    expect(controls).toContain(screen.getByRole('button', { name: 'Remove Team Alerts' }));
    controls.forEach((control) => expect(control).toHaveAccessibleName());
  });

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

  it('reaches an applied label row and the remove buttons of selected values with Tab', async () => {
    const { user } = await renderSidebar({
      ...createEmptyFilter(),
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

  it('toggles Hide plugin rules with the Space key', async () => {
    const { user, onChange } = await renderSidebar();

    focus(screen.getByRole('switch', { name: 'Hide plugin rules' }));
    await user.keyboard(' ');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ hidePluginRules: true }));
  });

  it('applies the rule name on Enter', async () => {
    const { user, onChange } = await renderSidebar();

    await user.type(screen.getByRole('textbox', { name: 'Rule name' }), 'cpu{Enter}');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ text: ['cpu'] }));
  });

  it('sets filter.metric from the recorded metric input', async () => {
    const { user, onChange } = await renderSidebar();

    await user.click(screen.getByRole('textbox', { name: 'Recorded metric' }));
    await user.paste('cpu_usage');

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ metric: 'cpu_usage' }));
  });

  it('says the folder control matches rules directly in the folder, and selecting one sets it as the namespace criterion', async () => {
    const { user, onChange } = await renderSidebar();
    expect(screen.getByText('Rules directly in this folder')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Folder' }));
    await user.click(await screen.findByLabelText('Alerting-folder'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ namespaces: ['e3d1f4fd-9e7c-4f63-9a9e-2b5a1d2e6a9c'] })
    );
  });

  it('opens the folder picker from the keyboard and selects a folder with arrow keys', async () => {
    const { user, onChange } = await renderSidebar();

    focus(screen.getByRole('button', { name: 'Folder' }));
    await user.keyboard('{Enter}');
    expect(await screen.findByPlaceholderText('Search folders')).toHaveFocus();

    await screen.findByLabelText('Alerting-folder');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ namespaces: ['e3d1f4fd-9e7c-4f63-9a9e-2b5a1d2e6a9c'] })
    );
  });

  it('selects a health by clicking its option', async () => {
    const { user, onChange } = await renderSidebar();

    await user.click(screen.getByRole('combobox', { name: 'Health' }));
    await user.click(await screen.findByRole('option', { name: 'OK' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ health: 'ok' }));
  });

  it('selects a health in the Health combobox with the keyboard', async () => {
    const { user, onChange } = await renderSidebar();

    focus(screen.getByRole('combobox', { name: 'Health' }));
    await user.keyboard('{ArrowDown}');
    await screen.findByRole('option', { name: 'No data' });
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ health: 'nodata' }));
  });

  it('selects a target data source with the keyboard', async () => {
    const { user, onChange } = await renderSidebar();

    focus(getTargetDataSourcePicker());
    await user.keyboard('Loki');
    await screen.findByText('Loki');
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ targetDataSourceUid: 'ds-2' }));
  });
});
