import { EditorView } from '@codemirror/view';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CodeBlock } from './CodeBlock';

describe('CodeBlock', () => {
  it('keeps highlighted INI selectable but read-only, without gutters', async () => {
    const user = userEvent.setup();
    const { container } = render(<CodeBlock code="[server]" />);
    const textbox = await screen.findByRole('textbox', { name: 'Code example' });
    const view = EditorView.findFromDOM(textbox)!;

    await waitFor(() =>
      expect(Array.from(textbox.querySelectorAll('.cm-line > span'), (span) => span.textContent).join('')).toBe(
        '[server]'
      )
    );
    expect(container.querySelector('.cm-gutters')).not.toBeInTheDocument();
    await user.click(textbox);
    await user.keyboard('{Control>}a{/Control}');
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe('[server]');
    await user.keyboard('replacement');
    expect(view.state.doc.toString()).toBe('[server]');
  });

  it('copies the exact source and can hide the copy button', async () => {
    const user = userEvent.setup();
    const secureContext = Object.getOwnPropertyDescriptor(window, 'isSecureContext');
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    const code = '[server]\r\n  http_port = 3000  \r\n';
    try {
      const { rerender } = render(<CodeBlock code={code} />);
      await screen.findByRole('textbox', { name: 'Code example' });
      await user.click(screen.getByRole('button', { name: 'Copy code to clipboard' }));
      expect(await navigator.clipboard.readText()).toBe(code);

      rerender(<CodeBlock code={code} copyCode={false} />);
      expect(screen.getByRole('textbox', { name: 'Code example' })).toHaveTextContent('[server]');
      expect(screen.queryByRole('button', { name: 'Copy code to clipboard' })).not.toBeInTheDocument();
    } finally {
      if (secureContext) {
        Object.defineProperty(window, 'isSecureContext', secureContext);
      } else {
        Reflect.deleteProperty(window, 'isSecureContext');
      }
    }
  });

  it.each([
    { code: 'key=value', height: '42px', overflowY: 'hidden' },
    { code: '[server]\nhttp_port=3000', height: '48px', overflowY: 'auto' },
    { code: Array(20).fill('key=value').join('\n'), height: '300px', overflowY: 'auto' },
  ])('uses $height height with $overflowY vertical overflow', async ({ code, height, overflowY }) => {
    render(<CodeBlock code={code} />);
    const textbox = await screen.findByRole('textbox', { name: 'Code example' });
    const view = EditorView.findFromDOM(textbox)!;

    expect(getComputedStyle(view.dom).height).toBe(height);
    expect(getComputedStyle(view.scrollDOM).overflowY).toBe(overflowY);
    expect(getComputedStyle(view.scrollDOM).overflowX).toBe('auto');
    expect(view.lineWrapping).toBe(false);
  });
});
