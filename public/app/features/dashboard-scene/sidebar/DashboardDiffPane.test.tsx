import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Sidebar, useSidebar } from '@grafana/ui';

import { DashboardDiffPane } from './DashboardDiffPane';
import { getDashboardDiffTexts, getDashboardResourceText } from './codePaneUtils';

jest.mock('../utils/utils', () => ({
  getDashboardSceneFor: jest.fn(() => ({})),
}));

jest.mock('app/core/components/MonacoDiffEditor/MonacoDiffEditor', () => ({
  MonacoDiffEditor: () => <div data-testid="diff-viewer" />,
}));

jest.mock('./codePaneUtils', () => ({
  getDashboardDiffTexts: jest.fn(),
  getDashboardResourceText: jest.fn(() => '{"spec":{}}'),
}));

function WrapSidebar({ children }: { children: React.ReactNode }) {
  const sidebarContext = useSidebar({});
  return <Sidebar contextValue={sidebarContext}>{children}</Sidebar>;
}

function setup() {
  const pane = new DashboardDiffPane({});
  const Component = DashboardDiffPane.Component;
  return render(
    <WrapSidebar>
      <Component model={pane} />
    </WrapSidebar>
  );
}

describe('DashboardDiffPane', () => {
  beforeEach(() => {
    jest.mocked(getDashboardDiffTexts).mockReset();
    jest.mocked(getDashboardResourceText).mockReset().mockReturnValue('{"spec":{}}');
  });

  it('has a stable pane id and the wide pane width', () => {
    const pane = new DashboardDiffPane({});

    expect(pane.getId()).toBe('diff');
    expect(pane.minWidth).toBe(700);
  });

  it('renders the diff without any interaction', () => {
    jest.mocked(getDashboardDiffTexts).mockReturnValue({ original: 'a', current: 'b', migratedFromV1: false });

    setup();

    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
  });

  it('compares the current resource text against the last saved version in the selected format', () => {
    jest.mocked(getDashboardDiffTexts).mockReturnValue({ original: 'a', current: 'b', migratedFromV1: false });

    setup();

    expect(getDashboardResourceText).toHaveBeenCalledWith(expect.anything(), 'json');
    expect(getDashboardDiffTexts).toHaveBeenCalledWith(expect.anything(), '{"spec":{}}', 'json');
  });

  it('re-renders the diff in yaml without re-reading the scene', async () => {
    jest.mocked(getDashboardDiffTexts).mockReturnValue({ original: 'a', current: 'b', migratedFromV1: false });

    setup();
    jest.mocked(getDashboardResourceText).mockClear();

    await userEvent.click(screen.getByRole('radio', { name: 'YAML' }));

    expect(getDashboardDiffTexts).toHaveBeenLastCalledWith(expect.anything(), '{"spec":{}}', 'yaml');
    expect(getDashboardResourceText).not.toHaveBeenCalled();
  });

  it('shows a migration notice when the last saved version was converted from v1', () => {
    jest.mocked(getDashboardDiffTexts).mockReturnValue({ original: 'a', current: 'b', migratedFromV1: true });

    setup();

    expect(screen.getByText(/migration to the new dashboard format/)).toBeInTheDocument();
    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
  });

  it('shows no migration notice for a v2 dashboard', () => {
    jest.mocked(getDashboardDiffTexts).mockReturnValue({ original: 'a', current: 'b', migratedFromV1: false });

    setup();

    expect(screen.queryByText(/migration to the new dashboard format/)).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no changes', () => {
    jest.mocked(getDashboardDiffTexts).mockReturnValue({ original: 'a', current: 'a', migratedFromV1: false });

    setup();

    expect(screen.getByText('No changes to show')).toBeInTheDocument();
    expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument();
  });

  it('shows an unavailable message when no diff can be produced', () => {
    jest.mocked(getDashboardDiffTexts).mockReturnValue(null);

    setup();

    expect(screen.getByText('Cannot show changes')).toBeInTheDocument();
    expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument();
  });

  it('hides the format and layout toggles when there is nothing to compare', () => {
    jest.mocked(getDashboardDiffTexts).mockReturnValue({ original: 'a', current: 'a', migratedFromV1: false });

    setup();

    expect(screen.queryByRole('radio', { name: 'YAML' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Inline' })).not.toBeInTheDocument();
  });

  it('offers side-by-side and inline layouts while a diff is shown', () => {
    jest.mocked(getDashboardDiffTexts).mockReturnValue({ original: 'a', current: 'b', migratedFromV1: false });

    setup();

    expect(screen.getByRole('radio', { name: 'Inline' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Side by side' })).toBeChecked();
  });
});
