import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';

import { Sidebar, useSidebar } from '@grafana/ui';

import { DashboardCodePane } from './DashboardCodePane';
import { getDashboardDiffTexts, getDashboardResourceText } from './codePaneUtils';

jest.mock('../utils/utils', () => ({
  getDashboardSceneFor: jest.fn(() => ({})),
}));

jest.mock('../v2schema/DashboardSchemaEditor', () => ({
  DashboardSchemaEditor: ({
    headerActions,
    headerLeftActions,
    contentOverride,
    onParseErrorChange,
  }: {
    headerActions?: ReactNode;
    headerLeftActions?: ReactNode;
    contentOverride?: ReactNode;
    onParseErrorChange?: (hasParseError: boolean) => void;
  }) => (
    <div data-testid="schema-editor">
      {headerLeftActions}
      {headerActions}
      {contentOverride ?? <div data-testid="code-editor" />}
      <button data-testid="trigger-parse-error" onClick={() => onParseErrorChange?.(true)} />
    </div>
  ),
}));

jest.mock('app/core/components/MonacoDiffEditor/MonacoDiffEditor', () => ({
  MonacoDiffEditor: () => <div data-testid="diff-viewer" />,
}));

jest.mock('./codePaneUtils', () => ({
  applyJsonToDashboard: jest.fn(() => ({ success: true })),
  getDashboardDiffTexts: jest.fn(),
  getDashboardResourceText: jest.fn(() => '{"spec":{}}'),
}));

function WrapSidebar({ children }: { children: React.ReactNode }) {
  const sidebarContext = useSidebar({});
  return <Sidebar contextValue={sidebarContext}>{children}</Sidebar>;
}

function setup() {
  const pane = new DashboardCodePane({});
  const Component = DashboardCodePane.Component;
  return render(
    <WrapSidebar>
      <Component model={pane} />
    </WrapSidebar>
  );
}

describe('DashboardCodePane', () => {
  beforeEach(() => {
    jest.mocked(getDashboardDiffTexts).mockReset();
    jest.mocked(getDashboardResourceText).mockReturnValue('{"spec":{}}');
  });

  it('renders the code editor and no diff by default', () => {
    setup();

    expect(screen.getByTestId('code-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument();
  });

  it('shows the diff in place of the code editor when the switch is turned on', async () => {
    jest.mocked(getDashboardDiffTexts).mockReturnValue({ original: 'a', current: 'b', migratedFromV1: false });
    setup();

    await userEvent.click(screen.getByRole('switch', { name: 'Show diff' }));

    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
    expect(screen.queryByTestId('code-editor')).not.toBeInTheDocument();
  });

  it('returns to the code editor when the switch is turned off again', async () => {
    jest.mocked(getDashboardDiffTexts).mockReturnValue({ original: 'a', current: 'b', migratedFromV1: false });
    setup();

    await userEvent.click(screen.getByRole('switch', { name: 'Show diff' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Show diff' }));

    expect(screen.getByTestId('code-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no changes', async () => {
    jest.mocked(getDashboardDiffTexts).mockReturnValue({ original: 'a', current: 'a', migratedFromV1: false });
    setup();

    await userEvent.click(screen.getByRole('switch', { name: 'Show diff' }));

    expect(screen.getByText('No changes to show')).toBeInTheDocument();
    expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument();
  });

  it('shows an unavailable message when no diff can be produced', async () => {
    jest.mocked(getDashboardDiffTexts).mockReturnValue(null);
    setup();

    await userEvent.click(screen.getByRole('switch', { name: 'Show diff' }));

    expect(screen.getByText('Cannot show changes')).toBeInTheDocument();
  });

  it('shows the inline/side-by-side selector only while the diff is shown', async () => {
    jest.mocked(getDashboardDiffTexts).mockReturnValue({ original: 'a', current: 'b', migratedFromV1: false });
    setup();

    expect(screen.queryByRole('radio', { name: 'Inline' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('switch', { name: 'Show diff' }));

    expect(screen.getByRole('radio', { name: 'Inline' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Side by side' })).toBeChecked();
  });

  it('disables the diff switch while the editor content is not valid JSON', () => {
    jest.mocked(getDashboardResourceText).mockReturnValue('not json {');
    setup();

    expect(screen.getByRole('switch', { name: 'Show diff' })).toBeDisabled();
  });

  it('disables the diff switch while the buffer has a syntax error', async () => {
    setup();

    await userEvent.click(screen.getByTestId('trigger-parse-error'));

    expect(screen.getByRole('switch', { name: 'Show diff' })).toBeDisabled();
  });

  it('renders a single editor instance while the modal is expanded', async () => {
    setup();

    await userEvent.click(screen.getByRole('button', { name: 'Expand editor' }));

    expect(screen.getAllByTestId('schema-editor')).toHaveLength(1);
  });

  it('shows a migration notice when the original was converted from v1', async () => {
    jest.mocked(getDashboardDiffTexts).mockReturnValue({ original: 'a', current: 'b', migratedFromV1: true });
    setup();

    await userEvent.click(screen.getByRole('switch', { name: 'Show diff' }));

    expect(screen.getByText(/migration to the new dashboard format/)).toBeInTheDocument();
    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
  });
});
