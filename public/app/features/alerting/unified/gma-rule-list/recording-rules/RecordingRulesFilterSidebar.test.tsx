import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { render, screen } from 'test/test-utils';

import { mockComboboxRect } from '@grafana/test-utils';

import { setupMswServer } from '../../mockApi';
import { type Criteria, createEmptyCriteria } from '../rule-search/criteria';

import { RecordingRulesFilterSidebar } from './RecordingRulesFilterSidebar';

// Combobox (used for Health) measures its own floating-element size to render option rows;
// jsdom reports zero for every element, so without this the option list never renders.
mockComboboxRect();

// The folder picker scrolls the focused row into view, which jsdom does not implement.
window.HTMLElement.prototype.scrollIntoView = function () {};

setupMswServer();

/** Feeds onChange back into criteria, so typing/selecting across multiple keystrokes behaves
 * like it does when a real page owns the criteria state. */
function ControlledSidebar() {
  const [criteria, setCriteria] = useState<Criteria>(createEmptyCriteria());
  return (
    <RecordingRulesFilterSidebar
      criteria={criteria}
      onChange={setCriteria}
      onClear={jest.fn()}
      hasActiveFilters={false}
    />
  );
}

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  DataSourcePicker: ({ current, onChange, ...rest }: { current?: string; onChange: (ds: { uid: string }) => void }) => (
    <select
      aria-label={(rest as { 'aria-label'?: string })['aria-label'] ?? 'data source'}
      value={current ?? ''}
      onChange={(e) => onChange({ uid: e.target.value })}
    >
      <option value="">none</option>
      <option value="ds-1">ds-1</option>
      <option value="target-ds-1">target-ds-1</option>
    </select>
  ),
}));

describe('RecordingRulesFilterSidebar', () => {
  it('ACC-2: the recorded metric input is found by role and name, and typing in it sets criteria.metric', async () => {
    const user = userEvent.setup();
    render(<ControlledSidebar />);

    await user.type(screen.getByRole('textbox', { name: 'Recorded metric' }), 'cpu_usage');

    expect(screen.getByRole('textbox', { name: 'Recorded metric' })).toHaveValue('cpu_usage');
  });

  it('SEARCH-3: selecting a folder calls onChange with that folder as the namespace criterion', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <RecordingRulesFilterSidebar
        criteria={createEmptyCriteria()}
        onChange={onChange}
        onClear={jest.fn()}
        hasActiveFilters={false}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Folder' }));
    await user.click(await screen.findByLabelText('Alerting-folder'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ namespaces: ['e3d1f4fd-9e7c-4f63-9a9e-2b5a1d2e6a9c'] })
    );
  });

  it.each([
    'Rule name',
    'Labels',
    'Folder',
    'Query data source',
    'Plugin rules',
    'Recorded metric',
    'Target data source',
    'Health',
  ])('ACC-6: the "%s" field is a labelled group', (name) => {
    render(<ControlledSidebar />);

    expect(screen.getByRole('group', { name })).toBeInTheDocument();
  });

  it('ACC-1: the rule name input is found by role and name and applies on Enter', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <RecordingRulesFilterSidebar
        criteria={createEmptyCriteria()}
        onChange={onChange}
        onClear={jest.fn()}
        hasActiveFilters={false}
      />
    );

    await user.type(screen.getByRole('textbox', { name: 'Rule name' }), 'cpu{Enter}');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ text: ['cpu'] }));
  });

  it('ACC-3: the folder picker is a button named Folder that opens from the keyboard and selects with arrow keys', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <RecordingRulesFilterSidebar
        criteria={createEmptyCriteria()}
        onChange={onChange}
        onClear={jest.fn()}
        hasActiveFilters={false}
      />
    );

    screen.getByRole('button', { name: 'Folder' }).focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByPlaceholderText('Search folders')).toHaveFocus();

    await screen.findByLabelText('Alerting-folder');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ namespaces: ['e3d1f4fd-9e7c-4f63-9a9e-2b5a1d2e6a9c'] })
    );
  });

  it('does not render Alert-only controls (dashboard, panel, contact point, policy, paused)', () => {
    render(
      <RecordingRulesFilterSidebar
        criteria={createEmptyCriteria()}
        onChange={jest.fn()}
        onClear={jest.fn()}
        hasActiveFilters={false}
      />
    );

    expect(screen.queryByLabelText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Contact point')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Notification policy')).not.toBeInTheDocument();
    expect(screen.queryByText('Paused')).not.toBeInTheDocument();
  });

  it('SEARCH-5: selecting a health calls onChange with that health', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(
      <RecordingRulesFilterSidebar
        criteria={createEmptyCriteria()}
        onChange={onChange}
        onClear={jest.fn()}
        hasActiveFilters={false}
      />
    );

    await user.click(screen.getByRole('combobox', { name: 'Health' }));
    await user.click(await screen.findByRole('option', { name: 'OK' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ health: 'ok' }));
  });

  it('does not offer an Alert state filter', () => {
    render(
      <RecordingRulesFilterSidebar
        criteria={createEmptyCriteria()}
        onChange={jest.fn()}
        onClear={jest.fn()}
        hasActiveFilters={false}
      />
    );

    expect(screen.queryByRole('combobox', { name: 'Alert state' })).not.toBeInTheDocument();
  });
});
