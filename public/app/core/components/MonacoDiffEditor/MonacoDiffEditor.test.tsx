import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MonacoDiffEditor } from './MonacoDiffEditor';

let lastOptions: Record<string, unknown> | undefined;

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  ReactMonacoDiffEditor: (props: { options?: Record<string, unknown> }) => {
    lastOptions = props.options;
    return <div data-testid="monaco-diff-editor" />;
  },
}));

describe('MonacoDiffEditor', () => {
  beforeEach(() => {
    window.localStorage.clear();
    lastOptions = undefined;
  });

  it('renders side-by-side and read-only by default', () => {
    render(<MonacoDiffEditor original="a" modified="b" />);

    expect(screen.getByTestId('monaco-diff-editor')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Side by side' })).toBeChecked();
    expect(lastOptions?.renderSideBySide).toBe(true);
    expect(lastOptions?.readOnly).toBe(true);
  });

  it('switches to an inline diff via the view mode selector', async () => {
    render(<MonacoDiffEditor original="a" modified="b" />);

    await userEvent.click(screen.getByRole('radio', { name: 'Inline' }));

    expect(lastOptions?.renderSideBySide).toBe(false);
  });

  it('persists the inline preference across instances', async () => {
    const { unmount } = render(<MonacoDiffEditor original="a" modified="b" />);
    await userEvent.click(screen.getByRole('radio', { name: 'Inline' }));
    unmount();

    render(<MonacoDiffEditor original="a" modified="b" />);

    expect(screen.getByRole('radio', { name: 'Inline' })).toBeChecked();
    expect(lastOptions?.renderSideBySide).toBe(false);
  });

  it('hides the built-in view mode selector when controlled via the inline prop', () => {
    render(<MonacoDiffEditor original="a" modified="b" inline />);

    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(lastOptions?.renderSideBySide).toBe(false);
  });
});
