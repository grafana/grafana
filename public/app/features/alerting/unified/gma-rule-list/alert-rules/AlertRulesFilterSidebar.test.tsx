import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

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
import { createEmptyCriteria } from '../rule-search/criteria';

import { AlertRulesFilterSidebar } from './AlertRulesFilterSidebar';

// Combobox measures its floating element; jsdom reports zero.
mockComboboxRect();

// jsdom lacks scrollIntoView, which the folder picker uses.
window.HTMLElement.prototype.scrollIntoView = function () {};

jest.mock('app/core/components/Select/DashboardPicker', () => ({
  DashboardPicker: ({
    value,
    onChange,
  }: {
    value?: string;
    onChange: (dashboard: { uid: string } | undefined) => void;
  }) => (
    <select
      aria-label="Dashboard"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? { uid: e.target.value } : undefined)}
    >
      <option value="">none</option>
      <option value="dash-1">dash-1</option>
    </select>
  ),
}));

// Exposes `noDefault` as text and `onClear` as a button to assert the sidebar passes both.
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  DataSourcePicker: ({
    current,
    noDefault,
    onClear,
    onChange,
  }: {
    current?: string;
    noDefault?: boolean;
    onClear?: () => void;
    onChange: (ds: { uid: string }) => void;
  }) => (
    <div>
      <span>{noDefault ? 'noDefault' : 'defaultsToOrgDefault'}</span>
      <select aria-label="Query data source" value={current ?? ''} onChange={(e) => onChange({ uid: e.target.value })}>
        <option value="">none</option>
        <option value="ds-1">ds-1</option>
      </select>
      {onClear && (
        <button type="button" onClick={onClear}>
          Clear data source
        </button>
      )}
    </div>
  ),
}));

const server = setupMswServer();

const FOLDER_UID = 'e3d1f4fd-9e7c-4f63-9a9e-2b5a1d2e6a9c';

const FOLDER_PARENTS_URL = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/:name/parents';

function mockDataSourceNames(nameByUid: Record<string, string>) {
  setDataSourceSrv({
    getList: () => [],
    getInstanceSettings: (ref: string) =>
      ref in nameByUid ? ({ uid: ref, name: nameByUid[ref] } as DataSourceInstanceSettings) : undefined,
  } as unknown as DataSourceSrv);
}

function renderSidebar(criteria = createEmptyCriteria()) {
  const onChange = jest.fn();
  const view = render(
    <AlertRulesFilterSidebar criteria={criteria} onChange={onChange} onClear={jest.fn()} hasActiveFilters={false} />
  );
  return { ...view, onChange };
}

function mockFolderTitles(titleByUid: Record<string, string>) {
  server.use(
    http.get(FOLDER_PARENTS_URL, ({ params }) => {
      const name = params.name as string;
      return HttpResponse.json({ items: [{ name, title: titleByUid[name] ?? name }] });
    })
  );
}

describe('AlertRulesFilterSidebar', () => {
  beforeEach(() => {
    server.use(
      listReceiverHandler(
        ListReceiverApiResponseFactory.build({
          items: [
            ContactPointFactory.build({ metadata: { uid: 'cp-uid-1' }, spec: { title: 'on-call', integrations: [] } }),
            ContactPointFactory.build({ metadata: { uid: 'cp-uid-2' }, spec: { title: 'pager', integrations: [] } }),
          ],
        })
      ),
      ...simpleRoutingTreesListScenario
    );
  });

  it('SEARCH-3: selecting a folder calls onChange with that folder as the namespace criterion', async () => {
    const { user, onChange } = renderSidebar();

    await user.click(screen.getByRole('button', { name: 'Folder' }));
    await user.click(await screen.findByLabelText('Alerting-folder'));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ namespaces: [FOLDER_UID] }));
  });

  it('SEARCH-3: selecting a query data source calls onChange with that data source UID', async () => {
    const { user, onChange } = renderSidebar();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Query data source' }), 'ds-1');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ dataSourceUids: ['ds-1'] }));
  });

  it('SEARCH-3: toggling "Hide plugin rules" calls onChange with hidePluginRules true', async () => {
    const { user, onChange } = renderSidebar();

    await user.click(screen.getByRole('switch', { name: 'Hide plugin rules' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ hidePluginRules: true }));
  });

  it('the panel ID field is disabled until a dashboard is selected', () => {
    renderSidebar();

    expect(screen.getByRole('spinbutton', { name: 'Panel ID' })).toBeDisabled();
  });

  it('the panel ID field is enabled once a dashboard is selected', () => {
    renderSidebar({ ...createEmptyCriteria(), dashboardUid: 'dash-1' });

    expect(screen.getByRole('spinbutton', { name: 'Panel ID' })).toBeEnabled();
  });

  it('SEARCH-4: choosing a contact point disables and clears the notification policy field', () => {
    renderSidebar({ ...createEmptyCriteria(), contactPoint: 'on-call' });

    expect(screen.getByRole('combobox', { name: 'Notification policy' })).toBeDisabled();
  });

  it('SEARCH-4: choosing a notification policy disables the contact point field', () => {
    renderSidebar({ ...createEmptyCriteria(), policy: 'escalation' });

    expect(screen.getByRole('combobox', { name: 'Contact point' })).toBeDisabled();
  });

  it('SEARCH-4: selecting Paused calls onChange with paused "true"', async () => {
    const { user, onChange } = renderSidebar();

    await user.click(screen.getByRole('combobox', { name: 'Paused' }));
    await user.click(await screen.findByRole('option', { name: 'Paused' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ paused: 'true' }));
  });

  it('the Default policy switch is disabled and explains it is not available yet when it is off', () => {
    renderSidebar();

    expect(screen.getByRole('switch', { name: 'Default policy' })).toBeDisabled();
    expect(screen.getAllByText("Filtering by the default policy isn't available yet.")).toHaveLength(1);
  });

  it('a default policy that arrived through the URL can still be cleared from the switch', async () => {
    const { user, onChange } = renderSidebar({ ...createEmptyCriteria(), policy: 'default' });

    const toggle = screen.getByRole('switch', { name: 'Default policy' });
    expect(toggle).toBeChecked();
    await user.click(toggle);

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ policy: undefined }));
  });

  it('Clear filters is disabled with no active filters and calls onClear when active', async () => {
    const user = userEvent.setup();
    const onClear = jest.fn();
    const sidebar = (hasActiveFilters: boolean) => (
      <AlertRulesFilterSidebar
        criteria={createEmptyCriteria()}
        onChange={jest.fn()}
        onClear={onClear}
        hasActiveFilters={hasActiveFilters}
      />
    );
    const { rerender } = render(sidebar(false));
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDisabled();

    rerender(sidebar(true));
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('NAV-5: shows an explanation under the folder field when a folder token is invalid', () => {
    render(
      <AlertRulesFilterSidebar
        criteria={createEmptyCriteria()}
        onChange={jest.fn()}
        onClear={jest.fn()}
        hasActiveFilters={false}
        issues={[{ key: 'namespace', reason: 'invalid' }]}
      />
    );

    expect(screen.getByText(/this filter is not valid/i)).toBeInTheDocument();
  });

  it('the query data source picker never preselects the org default (noDefault)', () => {
    renderSidebar();

    expect(screen.getByText('noDefault')).toBeInTheDocument();
  });

  it('SEARCH-3: shows every selected folder by title and removes only the one chosen', async () => {
    mockFolderTitles({ 'folder-1': 'Team Alerts', 'folder-2': 'Infra' });
    const { user, onChange } = renderSidebar({ ...createEmptyCriteria(), namespaces: ['folder-1', 'folder-2'] });

    expect(await screen.findByText('Team Alerts')).toBeInTheDocument();
    expect(await screen.findByText('Infra')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove Team Alerts' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ namespaces: ['folder-2'] }));
  });

  it('SEARCH-3: picking a folder adds it to the selected ones', async () => {
    mockFolderTitles({ 'folder-2': 'Infra' });
    const { user, onChange } = renderSidebar({ ...createEmptyCriteria(), namespaces: ['folder-2'] });

    await user.click(screen.getByRole('button', { name: 'Folder' }));
    await user.click(await screen.findByLabelText('Alerting-folder'));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ namespaces: ['folder-2', FOLDER_UID] }));
  });

  it('SEARCH-3: shows every selected query data source by name and removes only the one chosen', async () => {
    mockDataSourceNames({ 'ds-1': 'Prometheus', 'ds-2': 'Loki' });
    const { user, onChange } = renderSidebar({ ...createEmptyCriteria(), dataSourceUids: ['ds-1', 'ds-2'] });

    expect(await screen.findByText('Prometheus')).toBeInTheDocument();
    expect(await screen.findByText('Loki')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove Prometheus' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ dataSourceUids: ['ds-2'] }));
  });

  it('SEARCH-3: picking a query data source adds it to the selected ones', async () => {
    const { user, onChange } = renderSidebar({ ...createEmptyCriteria(), dataSourceUids: ['ds-2'] });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Query data source' }), 'ds-1');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ dataSourceUids: ['ds-2', 'ds-1'] }));
  });

  it('SEARCH-5: selecting a state calls onChange with that state', async () => {
    const { user, onChange } = renderSidebar();

    await user.click(screen.getByRole('combobox', { name: 'Alert state' }));
    await user.click(await screen.findByRole('option', { name: 'Firing' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ state: 'firing' }));
  });

  it('SEARCH-5: shows the legacy inactive state as Normal', () => {
    renderSidebar({ ...createEmptyCriteria(), state: 'inactive' });

    expect(screen.getByRole('combobox', { name: 'Alert state' })).toHaveValue('Normal');
  });

  it('SEARCH-5: selecting a health calls onChange with that health', async () => {
    const { user, onChange } = renderSidebar();

    await user.click(screen.getByRole('combobox', { name: 'Health' }));
    await user.click(await screen.findByRole('option', { name: 'No data' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ health: 'nodata' }));
  });

  it('SEARCH-3: a label row added with Add label filter is not applied until it has a key', async () => {
    const { user, onChange } = renderSidebar();

    await user.click(screen.getByRole('button', { name: 'Add label filter' }));
    await user.click(screen.getByRole('combobox', { name: 'Label operator' }));
    await user.click(await screen.findByRole('option', { name: '!=' }));
    await user.type(screen.getByRole('textbox', { name: 'Label value' }), 'api');
    await user.tab();

    expect(screen.getByRole('textbox', { name: 'Label key' })).toHaveValue('');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('SEARCH-3: entering the key of a new label row applies it with the chosen operator and value', async () => {
    const { user, onChange } = renderSidebar();

    await user.click(screen.getByRole('button', { name: 'Add label filter' }));
    await user.click(screen.getByRole('combobox', { name: 'Label operator' }));
    await user.click(await screen.findByRole('option', { name: '!=' }));
    await user.type(screen.getByRole('textbox', { name: 'Label value' }), 'api');
    await user.type(screen.getByRole('textbox', { name: 'Label key' }), 'team{Enter}');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ labels: [{ key: 'team', operator: 'notEqual', value: 'api' }] })
    );
  });

  it('SEARCH-3: removing the new label row before it has a key leaves the criteria untouched', async () => {
    const { user, onChange } = renderSidebar();

    await user.click(screen.getByRole('button', { name: 'Add label filter' }));
    await user.click(screen.getByRole('button', { name: 'Remove label filter' }));

    expect(screen.queryByRole('textbox', { name: 'Label key' })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('the contact point and notification policy fields show a selection placeholder', () => {
    renderSidebar();

    expect(screen.getByRole('combobox', { name: 'Contact point' })).toHaveAttribute(
      'placeholder',
      'Select contact point'
    );
    expect(screen.getByRole('combobox', { name: 'Notification policy' })).toHaveAttribute(
      'placeholder',
      'Select policy'
    );
  });

  describe('accessible names and keyboard use', () => {
    it('ACC-1: the rule name input is found by role and name and applies on Enter', async () => {
      const { user, onChange } = renderSidebar();

      await user.type(screen.getByRole('textbox', { name: 'Rule name' }), 'cpu{Enter}');

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ text: ['cpu'] }));
    });

    it('ACC-3: the folder picker is a button named Folder that opens from the keyboard and selects with arrow keys', async () => {
      const { user, onChange } = renderSidebar();

      screen.getByRole('button', { name: 'Folder' }).focus();
      await user.keyboard('{Enter}');
      const search = await screen.findByPlaceholderText('Search folders');
      expect(search).toHaveFocus();

      await screen.findByLabelText('Alerting-folder');
      await user.keyboard('{ArrowDown}{Enter}');

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ namespaces: [FOLDER_UID] }));
    });

    it('ACC-5: the contact point picker is named, filters by typing and selects with Enter', async () => {
      const { user, onChange } = renderSidebar();

      await user.click(screen.getByRole('combobox', { name: 'Contact point' }));
      await user.keyboard('pag');
      expect(await screen.findByRole('option', { name: /pager/ })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: /on-call/ })).not.toBeInTheDocument();
      await user.keyboard('{ArrowDown}{Enter}');

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ contactPoint: 'pager' }));
    });

    it('ACC-4: the notification policy picker is named and selects with the keyboard', async () => {
      const { user, onChange } = renderSidebar();

      await user.click(screen.getByRole('combobox', { name: 'Notification policy' }));
      await user.keyboard('platform');
      expect(await screen.findByRole('option', { name: /team-platform/ })).toBeInTheDocument();
      await user.keyboard('{ArrowDown}{Enter}');

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ policy: 'team-platform' }));
    });

    it('a contact point chosen by title is shown as selected in the picker, whose options are keyed by UID', async () => {
      const { user } = renderSidebar({ ...createEmptyCriteria(), contactPoint: 'pager' });

      const picker = screen.getByRole('combobox', { name: 'Contact point' });
      expect(picker).toHaveValue('pager');
      await user.click(picker);

      expect(await screen.findByRole('option', { name: /pager/ })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('option', { name: /on-call/ })).toHaveAttribute('aria-selected', 'false');
    });
  });
});
