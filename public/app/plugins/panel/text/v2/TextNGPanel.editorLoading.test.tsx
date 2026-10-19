import { screen } from '@testing-library/react';

import { CoreApp } from '@grafana/data';

import { TextMode } from '../panelcfg.gen';

import { createProps, renderPanel } from './test-utils';

// Only the first edit-mode render in a module registry suspends, so this test needs its own file to avoid
// depending on test order in TextNGPanel.test.tsx.

// Stub the lazy CodeMirror bundle used by the inline editor.
jest.mock('@grafana/ui/codemirror', () => ({
  ...jest.requireActual('@grafana/ui/codemirror'),
  createVariableCompletionSource: () => () => null,
}));

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  __esModule: true,
  CodeMirrorEditor: ({ value, 'aria-label': ariaLabel }: { value: string; 'aria-label'?: string }) => (
    <textarea aria-label={ariaLabel} value={value} readOnly />
  ),
}));

describe('TextNGPanel edit mode', () => {
  it('shows the rendered content while the editor is loading', async () => {
    const props = createProps((str: string) => str, {
      options: { content: '# Hello', mode: TextMode.Markdown },
    });

    renderPanel(props, CoreApp.PanelEditor);

    // Before the lazy editor chunk resolves, the fallback must show rendered content, not a blank body.
    expect(screen.getByTestId('TextNGPanel-converted-content').innerHTML).toContain('Hello');

    expect(await screen.findByTestId('TextNGEditor')).toBeInTheDocument();
    expect(screen.queryByTestId('TextNGPanel-converted-content')).not.toBeInTheDocument();
  });
});

it('keeps code visible while the read-only code renderer loads', async () => {
  const props = createProps((str: string) => str, {
    options: { content: 'SELECT 1', mode: TextMode.Code },
  });

  renderPanel(props);

  expect(screen.getByText('SELECT 1', { selector: 'pre' })).toBeVisible();
  expect(await screen.findByRole('textbox', { name: 'Code content' })).toHaveValue('SELECT 1');
});
jest.mock('./SandboxFrame');
