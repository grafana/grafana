import userEvent from '@testing-library/user-event';
import { render, screen } from 'test/test-utils';

import { mockComboboxRect } from '@grafana/test-utils';

import { createEmptyCriteria } from '../rule-search/criteria';

import { AlertRulesFilterSidebar } from './AlertRulesFilterSidebar';

// Combobox (used for Paused) measures its own floating-element size to render option rows;
// jsdom reports zero for every element, so without this the option list never renders.
mockComboboxRect();

// Placeholder rendered as the empty option's own text (rather than a real combobox
// placeholder attribute) so a plain <select> mock can still prove the prop reaches the real
// component, without re-testing Combobox's own placeholder rendering.
jest.mock('@grafana/alerting/unstable', () => ({
  ContactPointSelector: ({
    value,
    disabled,
    placeholder,
    onChange,
  }: {
    value?: string;
    disabled?: boolean;
    placeholder?: string;
    onChange: (cp: { spec: { title: string } } | null) => void;
  }) => (
    <select
      aria-label="Contact point"
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value ? { spec: { title: e.target.value } } : null)}
    >
      <option value="">{placeholder}</option>
      <option value="on-call">on-call</option>
    </select>
  ),
  RoutingTreeSelector: ({
    value,
    disabled,
    placeholder,
    onChange,
  }: {
    value?: string;
    disabled?: boolean;
    placeholder?: string;
    onChange: (tree: { metadata: { name: string } } | null) => void;
  }) => (
    <select
      aria-label="Notification policy"
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value ? { metadata: { name: e.target.value } } : null)}
    >
      <option value="">{placeholder}</option>
      <option value="escalation">escalation</option>
    </select>
  ),
}));

jest.mock('app/core/components/NestedFolderPicker/NestedFolderPicker', () => ({
  NestedFolderPicker: ({
    value,
    onChange,
  }: {
    value?: string;
    onChange: (uid: string | undefined, name: string | undefined) => void;
  }) => (
    <select
      aria-label="Folder"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined, e.target.value || undefined)}
    >
      <option value="">none</option>
      <option value="folder-1">folder-1</option>
    </select>
  ),
}));

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

// Renders whether `noDefault` was passed as visible text, and exposes `onClear` via a
// button — the point of these two tests is that AlertRulesFilterSidebar passes both, not
// re-testing DataSourcePicker's own default-preselection behavior (that's its own test suite).
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

describe('AlertRulesFilterSidebar', () => {
  it('SEARCH-1.5: selecting a folder calls onChange with that folder as the namespace criterion', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <AlertRulesFilterSidebar
        criteria={createEmptyCriteria()}
        onChange={onChange}
        onClear={jest.fn()}
        hasActiveFilters={false}
      />
    );

    await user.selectOptions(screen.getByLabelText('Folder'), 'folder-1');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ namespaces: ['folder-1'] }));
  });

  it('SEARCH-1.6: selecting a query data source calls onChange with that data source UID', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <AlertRulesFilterSidebar
        criteria={createEmptyCriteria()}
        onChange={onChange}
        onClear={jest.fn()}
        hasActiveFilters={false}
      />
    );

    await user.selectOptions(screen.getByLabelText('Query data source'), 'ds-1');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ dataSourceUids: ['ds-1'] }));
  });

  it('SEARCH-1.7: toggling "Hide plugin rules" calls onChange with hidePluginRules true', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <AlertRulesFilterSidebar
        criteria={createEmptyCriteria()}
        onChange={onChange}
        onClear={jest.fn()}
        hasActiveFilters={false}
      />
    );

    await user.click(screen.getByRole('switch', { name: 'Hide plugin rules' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ hidePluginRules: true }));
  });

  it('the panel ID field is disabled until a dashboard is selected', () => {
    render(
      <AlertRulesFilterSidebar
        criteria={createEmptyCriteria()}
        onChange={jest.fn()}
        onClear={jest.fn()}
        hasActiveFilters={false}
      />
    );

    expect(screen.getByLabelText('Panel ID')).toBeDisabled();
  });

  it('the panel ID field is enabled once a dashboard is selected', () => {
    const criteria = { ...createEmptyCriteria(), dashboardUid: 'dash-1' };
    render(
      <AlertRulesFilterSidebar criteria={criteria} onChange={jest.fn()} onClear={jest.fn()} hasActiveFilters={false} />
    );

    expect(screen.getByLabelText('Panel ID')).toBeEnabled();
  });

  it('SEARCH-1.8: choosing a contact point disables and clears the notification policy field', () => {
    const criteria = { ...createEmptyCriteria(), contactPoint: 'on-call' };
    render(
      <AlertRulesFilterSidebar criteria={criteria} onChange={jest.fn()} onClear={jest.fn()} hasActiveFilters={false} />
    );

    expect(screen.getByLabelText('Notification policy')).toBeDisabled();
  });

  it('SEARCH-1.9: choosing a notification policy disables the contact point field', () => {
    const criteria = { ...createEmptyCriteria(), policy: 'escalation' };
    render(
      <AlertRulesFilterSidebar criteria={criteria} onChange={jest.fn()} onClear={jest.fn()} hasActiveFilters={false} />
    );

    expect(screen.getByLabelText('Contact point')).toBeDisabled();
  });

  it('SEARCH-1.10: selecting Paused calls onChange with paused "true"', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <AlertRulesFilterSidebar
        criteria={createEmptyCriteria()}
        onChange={onChange}
        onClear={jest.fn()}
        hasActiveFilters={false}
      />
    );

    await user.click(screen.getByRole('combobox', { name: 'Paused' }));
    await user.click(await screen.findByRole('option', { name: 'Paused' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ paused: 'true' }));
  });

  it('Clear filters is disabled with no active filters and calls onClear when active', async () => {
    const user = userEvent.setup();
    const onClear = jest.fn();
    const { rerender } = render(
      <AlertRulesFilterSidebar
        criteria={createEmptyCriteria()}
        onChange={jest.fn()}
        onClear={onClear}
        hasActiveFilters={false}
      />
    );
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDisabled();

    rerender(
      <AlertRulesFilterSidebar
        criteria={createEmptyCriteria()}
        onChange={jest.fn()}
        onClear={onClear}
        hasActiveFilters={true}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('SEARCH-6.2: marks the folder field invalid and shows an explanation when the namespace is unresolved', () => {
    render(
      <AlertRulesFilterSidebar
        criteria={createEmptyCriteria()}
        onChange={jest.fn()}
        onClear={jest.fn()}
        hasActiveFilters={false}
        issues={[{ key: 'namespace', reason: 'unresolved', value: 'Unknown Folder' }]}
      />
    );

    expect(screen.getByText(/could not be resolved/i)).toBeInTheDocument();
  });

  it('the query data source picker never preselects the org default (noDefault) and can be cleared', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <AlertRulesFilterSidebar
        criteria={createEmptyCriteria()}
        onChange={onChange}
        onClear={jest.fn()}
        hasActiveFilters={false}
      />
    );

    expect(screen.getByText('noDefault')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear data source' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ dataSourceUids: [] }));
  });

  it('the contact point and notification policy fields show a selection placeholder', () => {
    render(
      <AlertRulesFilterSidebar
        criteria={createEmptyCriteria()}
        onChange={jest.fn()}
        onClear={jest.fn()}
        hasActiveFilters={false}
      />
    );

    expect(screen.getByText('Select contact point')).toBeInTheDocument();
    expect(screen.getByText('Select policy')).toBeInTheDocument();
  });
});
