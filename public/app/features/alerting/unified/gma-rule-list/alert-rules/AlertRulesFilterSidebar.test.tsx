import { act, render, screen } from 'test/test-utils';

import {
  ContactPointFactory,
  ListReceiverApiResponseFactory,
  listReceiverHandler,
  simpleRoutingTreesListScenario,
} from '@grafana/alerting/testing';
import { mockComboboxRect } from '@grafana/test-utils';

import { setupMswServer } from '../../mockApi';
import { mockDataSource } from '../../mocks';
import { setupDataSources } from '../../testSetup/datasources';
import { getInteractiveControls, tabSequence } from '../mocks/filterSidebarTestUtils';
import { mockFolderParents } from '../mocks/handlers';
import { type FilterIssue } from '../token-search/filterIssues';
import { type RuleSearchFilter, createEmptyFilter } from '../token-search/ruleSearchFilter';

import { AlertRulesFilterSidebar } from './AlertRulesFilterSidebar';

// Real pickers, not stand-ins, so their accessible names and keyboard behavior are exercised.
// Combobox measures its floating element; jsdom reports zero.
mockComboboxRect();

// jsdom lacks scrollIntoView, which the folder picker uses.
window.HTMLElement.prototype.scrollIntoView = function () {};

const server = setupMswServer();

const FOLDER_UID = 'e3d1f4fd-9e7c-4f63-9a9e-2b5a1d2e6a9c';

async function renderSidebar(
  filter: RuleSearchFilter = createEmptyFilter(),
  { hasActiveFilters = true, issues }: { hasActiveFilters?: boolean; issues?: FilterIssue[] } = {}
) {
  const onChange = jest.fn();
  const onClear = jest.fn();
  const view = render(
    <AlertRulesFilterSidebar
      filter={filter}
      onChange={onChange}
      onClear={onClear}
      hasActiveFilters={hasActiveFilters}
      issues={issues}
    />
  );
  // The data source picker loads its implementation asynchronously.
  await screen.findByRole('combobox', { name: 'Select a data source' });
  return { ...view, onChange, onClear };
}

function focus(element: HTMLElement) {
  act(() => element.focus());
}

describe('AlertRulesFilterSidebar', () => {
  beforeEach(() => {
    setupDataSources(
      mockDataSource({ uid: 'ds-1', name: 'Prometheus' }, { metrics: true }),
      mockDataSource({ uid: 'ds-2', name: 'Loki' }, { metrics: true })
    );
    mockFolderParents({ 'folder-1': 'Team Alerts', 'folder-2': 'Infra' });
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

  describe('rule name', () => {
    it('applies the typed name on Enter', async () => {
      const { user, onChange } = await renderSidebar();

      await user.type(screen.getByRole('textbox', { name: 'Rule name' }), 'cpu{Enter}');

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ text: ['cpu'] }));
    });
  });

  describe('folders', () => {
    it('adds a picked folder to the selected ones', async () => {
      const { user, onChange } = await renderSidebar({ ...createEmptyFilter(), namespaces: ['folder-2'] });

      await user.click(screen.getByRole('button', { name: 'Folder' }));
      await user.click(await screen.findByLabelText('Alerting-folder'));

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ namespaces: ['folder-2', FOLDER_UID] }));
    });

    it('opens the folder picker from the keyboard and selects with the arrow keys', async () => {
      const { user, onChange } = await renderSidebar();

      focus(screen.getByRole('button', { name: 'Folder' }));
      await user.keyboard('{Enter}');
      expect(await screen.findByPlaceholderText('Search folders')).toHaveFocus();
      await screen.findByLabelText('Alerting-folder');
      await user.keyboard('{ArrowDown}{Enter}');

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ namespaces: [FOLDER_UID] }));
    });

    it('shows every selected folder by title and removes only the one chosen', async () => {
      const { user, onChange } = await renderSidebar({
        ...createEmptyFilter(),
        namespaces: ['folder-1', 'folder-2'],
      });

      expect(await screen.findByText('Infra')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Remove Team Alerts' }));

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ namespaces: ['folder-2'] }));
    });

    it('explains an invalid folder token under the folder field', async () => {
      await renderSidebar(createEmptyFilter(), { issues: [{ key: 'namespace', reason: 'invalid' }] });

      expect(screen.getByText(/this filter is not valid/i)).toBeInTheDocument();
    });
  });

  describe('query data sources', () => {
    it('adds a data source picked with the keyboard to the selected ones', async () => {
      const { user, onChange } = await renderSidebar({ ...createEmptyFilter(), dataSourceUids: ['ds-1'] });

      focus(screen.getByRole('combobox', { name: 'Select a data source' }));
      await user.keyboard('Loki');
      await screen.findByText('Loki');
      await user.keyboard('{Enter}');

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ dataSourceUids: ['ds-1', 'ds-2'] }));
    });

    it('shows every selected data source by name and removes only the one chosen', async () => {
      const { user, onChange } = await renderSidebar({ ...createEmptyFilter(), dataSourceUids: ['ds-1', 'ds-2'] });

      expect(screen.getByRole('button', { name: 'Remove Loki' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Remove Prometheus' }));

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ dataSourceUids: ['ds-2'] }));
    });
  });

  describe('plugin rules', () => {
    it.each([
      {
        name: 'click',
        toggle: (user: Awaited<ReturnType<typeof renderSidebar>>['user']) =>
          user.click(screen.getByRole('switch', { name: 'Hide plugin rules' })),
      },
      {
        name: 'Space key',
        toggle: (user: Awaited<ReturnType<typeof renderSidebar>>['user']) => {
          focus(screen.getByRole('switch', { name: 'Hide plugin rules' }));
          return user.keyboard(' ');
        },
      },
    ])('hides plugin rules on $name', async ({ toggle }) => {
      const { user, onChange } = await renderSidebar();

      await toggle(user);

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ hidePluginRules: true }));
    });
  });

  describe('dashboard and panel', () => {
    it.each([
      { name: 'disabled until a dashboard is selected', filter: createEmptyFilter(), enabled: false },
      {
        name: 'enabled once a dashboard is selected',
        filter: { ...createEmptyFilter(), dashboardUid: 'dash-1' },
        enabled: true,
      },
    ])('the Panel ID field is $name', async ({ filter, enabled }) => {
      await renderSidebar(filter);

      const panelId = screen.getByRole('spinbutton', { name: 'Panel ID' });
      if (enabled) {
        expect(panelId).toBeEnabled();
      } else {
        expect(panelId).toBeDisabled();
      }
    });
  });

  describe('notification routing', () => {
    it('picks a contact point by filtering and selecting with the keyboard', async () => {
      const { user, onChange } = await renderSidebar();

      await user.click(screen.getByRole('combobox', { name: 'Contact point' }));
      await user.keyboard('pag');
      expect(await screen.findByRole('option', { name: /pager/ })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: /on-call/ })).not.toBeInTheDocument();
      await user.keyboard('{ArrowDown}{Enter}');

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ contactPoint: 'pager' }));
    });

    it('shows a contact point chosen by title as selected in the picker, whose options are keyed by UID', async () => {
      const { user } = await renderSidebar({ ...createEmptyFilter(), contactPoint: 'pager' });

      const picker = screen.getByRole('combobox', { name: 'Contact point' });
      expect(picker).toHaveValue('pager');
      await user.click(picker);

      expect(await screen.findByRole('option', { name: /pager/ })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('option', { name: /on-call/ })).toHaveAttribute('aria-selected', 'false');
    });

    it('picks a named notification policy by filtering and selecting with the keyboard', async () => {
      const { user, onChange } = await renderSidebar();

      await user.click(screen.getByRole('combobox', { name: 'Notification policy' }));
      await user.keyboard('platform');
      expect(await screen.findByRole('option', { name: /team-platform/ })).toBeInTheDocument();
      await user.keyboard('{ArrowDown}{Enter}');

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ policy: 'team-platform' }));
    });

    it('selects the default policy, not a named tree, from the policy picker', async () => {
      const { user, onChange } = await renderSidebar();

      await user.click(screen.getByRole('combobox', { name: 'Notification policy' }));
      await user.click(await screen.findByRole('option', { name: /Default policy/ }));

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ policy: 'default' }));
    });

    it.each([
      { chosen: 'contactPoint', filter: { contactPoint: 'on-call' }, disabled: 'Notification policy' },
      { chosen: 'policy', filter: { policy: 'escalation' }, disabled: 'Contact point' },
    ])('disables the $disabled field once a $chosen is chosen', async ({ filter, disabled }) => {
      await renderSidebar({ ...createEmptyFilter(), ...filter });

      expect(screen.getByRole('combobox', { name: disabled })).toBeDisabled();
    });

    it('disables the Default policy switch with an explanation while it is off', async () => {
      await renderSidebar();

      expect(screen.getByRole('switch', { name: 'Default policy' })).toBeDisabled();
      expect(screen.getByText("Filtering by the default policy isn't available yet.")).toBeInTheDocument();
    });

    it('lets a default policy that arrived through the URL be cleared from the switch', async () => {
      const { user, onChange } = await renderSidebar({ ...createEmptyFilter(), policy: 'default' });

      const toggle = screen.getByRole('switch', { name: 'Default policy' });
      expect(toggle).toBeChecked();
      await user.click(toggle);

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ policy: undefined }));
    });
  });

  describe('rule status', () => {
    it.each([
      { name: 'Paused', option: 'Paused', arrowPresses: 1, expected: { paused: 'true' } },
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

    it('shows the legacy inactive state as Normal', async () => {
      await renderSidebar({ ...createEmptyFilter(), state: 'inactive' });

      expect(screen.getByRole('combobox', { name: 'Alert state' })).toHaveValue('Normal');
    });
  });

  describe('label filters', () => {
    it('keeps a new label row out of the filter until it has a key, then applies it with its operator and value', async () => {
      const { user, onChange } = await renderSidebar();

      await user.click(screen.getByRole('button', { name: 'Add label filter' }));
      expect(screen.getByRole('textbox', { name: 'Label key' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add label filter' })).toBeDisabled();
      await user.click(screen.getByRole('combobox', { name: 'Label operator' }));
      await user.click(await screen.findByRole('option', { name: '!=' }));
      await user.type(screen.getByRole('textbox', { name: 'Label value' }), 'api');
      await user.tab();

      expect(screen.getByRole('textbox', { name: 'Label key' })).toHaveValue('');
      expect(onChange).not.toHaveBeenCalled();

      await user.type(screen.getByRole('textbox', { name: 'Label key' }), 'team{Enter}');

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ labels: [{ key: 'team', operator: 'notEqual', value: 'api' }] })
      );
    });

    it('keeps a label row with a key but no value visible and sends it once it has a value', async () => {
      const { user, onChange } = await renderSidebar();

      await user.click(screen.getByRole('button', { name: 'Add label filter' }));
      await user.type(screen.getByRole('textbox', { name: 'Label key' }), 'team{Enter}');

      expect(screen.getByRole('textbox', { name: 'Label key' })).toHaveValue('team');
      expect(onChange).not.toHaveBeenCalled();

      await user.type(screen.getByRole('textbox', { name: 'Label value' }), 'api{Enter}');

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ labels: [{ key: 'team', operator: 'equal', value: 'api' }] })
      );
    });

    it('sends a label with the exists operator without a value', async () => {
      const { user, onChange } = await renderSidebar();

      await user.click(screen.getByRole('button', { name: 'Add label filter' }));
      await user.type(screen.getByRole('textbox', { name: 'Label key' }), 'team{Enter}');
      await user.click(screen.getByRole('combobox', { name: 'Label operator' }));
      await user.click(await screen.findByRole('option', { name: 'exists' }));

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ labels: [{ key: 'team', operator: 'exists', value: undefined }] })
      );
    });

    it('leaves the filter untouched when the new label row is removed before it has a key', async () => {
      const { user, onChange } = await renderSidebar();

      await user.click(screen.getByRole('button', { name: 'Add label filter' }));
      await user.click(screen.getByRole('button', { name: 'Remove label filter' }));

      expect(screen.queryByRole('textbox', { name: 'Label key' })).not.toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('adds a label row with Enter on Add label filter', async () => {
      const { user } = await renderSidebar();

      focus(screen.getByRole('button', { name: 'Add label filter' }));
      await user.keyboard('{Enter}');

      expect(screen.getByRole('textbox', { name: 'Label key' })).toBeInTheDocument();
    });
  });

  describe('Clear filters', () => {
    it('is disabled without active filters', async () => {
      await renderSidebar(createEmptyFilter(), { hasActiveFilters: false });

      expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDisabled();
    });

    it('calls onClear when there are active filters', async () => {
      const { user, onClear } = await renderSidebar();

      await user.click(screen.getByRole('button', { name: 'Clear filters' }));

      expect(onClear).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    const APPLIED: RuleSearchFilter = {
      ...createEmptyFilter(),
      labels: [{ key: 'team', operator: 'equal', value: 'api' }],
      namespaces: ['folder-1'],
      dataSourceUids: ['ds-1'],
    };

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

    it('names the controls of an applied label, folder and data source, and leaves no control unnamed', async () => {
      const { container } = await renderSidebar(APPLIED);

      expect(screen.getByRole('textbox', { name: 'Label key' })).toHaveValue('team');
      expect(screen.getByRole('combobox', { name: 'Label operator' })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Label value' })).toHaveValue('api');
      expect(screen.getByRole('button', { name: 'Remove label filter' })).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'Remove Team Alerts' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove Prometheus' })).toBeInTheDocument();
      getInteractiveControls(container).forEach((control) => expect(control).toHaveAccessibleName());
    });

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
      expect(visited).not.toContain(screen.getByRole('spinbutton', { name: 'Panel ID' }));
      expect(visited).not.toContain(screen.getByRole('switch', { name: 'Default policy' }));
    });

    it('reaches an applied label row and the remove buttons of selected values with Tab', async () => {
      const { user } = await renderSidebar(APPLIED);
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
  });
});
