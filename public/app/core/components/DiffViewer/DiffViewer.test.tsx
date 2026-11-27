import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement } from 'react';

import { store } from '@grafana/data';

import { InlineDiffToggle, useInlineDiffPreference } from '../MonacoDiffEditor/inlineDiffPreference';

import { DiffViewer } from './DiffViewer';

function HeaderControlledDiffViewer(): ReactElement {
  const [inline, setInline] = useInlineDiffPreference();

  return (
    <>
      <InlineDiffToggle value={inline} onChange={setInline} />
      <DiffViewer original="before" modified="after" inline={inline} />
    </>
  );
}

describe('DiffViewer preference', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('switches from side by side to inline and persists the existing preference across instances', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<DiffViewer original="before" modified="after" height="200px" />);

    expect(await screen.findByRole('textbox', { name: 'Original' })).toHaveTextContent('before');
    expect(screen.getByRole('radio', { name: 'Side by side' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'Inline' }));

    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: 'Modified' })).toHaveTextContent('after');
    expect(store.getBool('grafana.monaco-diff-editor.inline', false)).toBe(true);
    unmount();

    render(<DiffViewer original="before" modified="after" height="200px" />);

    expect(await screen.findByRole('textbox', { name: 'Modified' })).toHaveTextContent('after');
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByRole('radio', { name: 'Inline' })).toBeChecked();
  });

  it('uses a saved Monaco preference and lets controlled mode override it without persisting', async () => {
    store.set('grafana.monaco-diff-editor.inline', true);
    const { rerender } = render(<DiffViewer original="before" modified="after" />);

    expect(await screen.findByRole('textbox', { name: 'Modified' })).toHaveTextContent('after');
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByRole('radio', { name: 'Inline' })).toBeChecked();

    rerender(<DiffViewer original="before" modified="after" inline={false} />);

    expect(screen.getByRole('textbox', { name: 'Original' })).toHaveTextContent('before');
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(store.getBool('grafana.monaco-diff-editor.inline', false)).toBe(true);

    rerender(<DiffViewer original="before" modified="after" inline />);

    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: 'Modified' })).toHaveTextContent('after');
  });

  it('supports a separate header toggle with the shared saved preference', async () => {
    const user = userEvent.setup();
    render(<HeaderControlledDiffViewer />);

    expect(await screen.findByRole('textbox', { name: 'Original' })).toHaveTextContent('before');
    expect(screen.getAllByRole('radio')).toHaveLength(2);

    await user.click(screen.getByRole('radio', { name: 'Inline' }));

    expect(screen.getByRole('textbox', { name: 'Modified' })).toHaveTextContent('after');
    expect(screen.queryByRole('textbox', { name: 'Original' })).not.toBeInTheDocument();
    expect(store.getBool('grafana.monaco-diff-editor.inline', false)).toBe(true);
  });
});
