import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { render, screen } from 'test/test-utils';

import { type Criteria, createEmptyCriteria } from '../rule-search/criteria';

import { RecordingRulesFilterSidebar } from './RecordingRulesFilterSidebar';

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
  it('SEARCH-1.11: typing a metric ends up in criteria.metric', async () => {
    const user = userEvent.setup();
    render(<ControlledSidebar />);

    await user.type(screen.getByPlaceholderText('Metric name (exact match)'), 'cpu_usage');

    expect(screen.getByPlaceholderText('Metric name (exact match)')).toHaveValue('cpu_usage');
  });

  it('SEARCH-1.12: selecting a folder calls onChange with that folder as the namespace criterion', async () => {
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

    await user.selectOptions(screen.getByLabelText('Folder'), 'folder-1');

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ namespaces: ['folder-1'] }));
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

  it('SEARCH-5.1: shows Health as unavailable but visible', () => {
    render(
      <RecordingRulesFilterSidebar
        criteria={createEmptyCriteria()}
        onChange={jest.fn()}
        onClear={jest.fn()}
        hasActiveFilters={false}
      />
    );

    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/not available yet/i)).toBeInTheDocument();
  });
});
