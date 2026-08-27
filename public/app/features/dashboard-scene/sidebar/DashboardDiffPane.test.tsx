import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Sidebar, useSidebar } from '@grafana/ui';
import { type MonacoDiffEditorProps } from 'app/core/components/MonacoDiffEditor/MonacoDiffEditor';

import { DashboardDiffPane, type DashboardDiffPaneState } from './DashboardDiffPane';

jest.mock('app/core/components/MonacoDiffEditor/MonacoDiffEditor', () => ({
  MonacoDiffEditor: (props: MonacoDiffEditorProps) => (
    <div data-testid="diff-viewer" data-original={props.original} data-modified={props.modified}>
      {props.language}
    </div>
  ),
}));

function WrapSidebar({ children }: { children: React.ReactNode }) {
  const sidebarContext = useSidebar({});
  return <Sidebar contextValue={sidebarContext}>{children}</Sidebar>;
}

function setup(state: DashboardDiffPaneState) {
  const pane = new DashboardDiffPane(state);
  const Component = DashboardDiffPane.Component;
  const result = render(
    <WrapSidebar>
      <Component model={pane} />
    </WrapSidebar>
  );

  return { pane, ...result };
}

describe('DashboardDiffPane', () => {
  it('has a stable pane id and the wide pane width', () => {
    const pane = new DashboardDiffPane({ original: 'a', current: 'b' });

    expect(pane.getId()).toBe('diff');
    expect(pane.minWidth).toBe(700);
  });

  it('renders the given texts as a json diff', () => {
    setup({ original: '{"a":1}', current: '{"a":2}' });

    const viewer = screen.getByTestId('diff-viewer');
    expect(viewer).toHaveAttribute('data-original', '{"a":1}');
    expect(viewer).toHaveAttribute('data-modified', '{"a":2}');
    expect(viewer).toHaveTextContent('json');
  });

  it('re-renders when the texts change while the pane stays mounted', () => {
    const { pane } = setup({ original: '{"a":1}', current: '{"a":2}' });

    act(() => {
      pane.setState({ original: '{"b":1}', current: '{"b":2}' });
    });

    const viewer = screen.getByTestId('diff-viewer');
    expect(viewer).toHaveAttribute('data-original', '{"b":1}');
    expect(viewer).toHaveAttribute('data-modified', '{"b":2}');
  });

  it('defaults the pane header to Changes', () => {
    setup({ original: 'a', current: 'b' });

    expect(screen.getByText('Changes')).toBeInTheDocument();
  });

  it('uses the given title as the pane header', () => {
    setup({ original: 'a', current: 'b', title: 'Assistant changes' });

    expect(screen.getByText('Assistant changes')).toBeInTheDocument();
    expect(screen.queryByText('Changes')).not.toBeInTheDocument();
  });

  it('shows an empty state when both texts are identical', () => {
    setup({ original: 'a', current: 'a' });

    expect(screen.getByText('No changes to show')).toBeInTheDocument();
    expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument();
  });

  it('renders a caller-owned action and calls back on click', async () => {
    const onClick = jest.fn();
    setup({ original: '{"a":1}', current: '{"a":2}', action: { label: 'Revert', onClick } });

    await userEvent.click(screen.getByRole('button', { name: 'Revert' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders no action when the caller supplies none', () => {
    setup({ original: '{"a":1}', current: '{"a":2}' });

    expect(screen.queryByRole('button', { name: 'Revert' })).not.toBeInTheDocument();
  });
});
