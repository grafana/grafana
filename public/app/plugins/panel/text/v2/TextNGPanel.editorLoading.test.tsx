import { screen } from '@testing-library/react';

import { CoreApp } from '@grafana/data';

import { TextMode } from '../panelcfg.gen';

import { createProps, renderPanel } from './test-utils';

// Only the first edit-mode render in a module registry suspends, so this test needs its own file to avoid
// depending on test order in TextNGPanel.test.tsx.

// Stub the lazy CodeMirror bundle used by the inline editor.
jest.mock('@grafana/ui/unstable', () => ({
  ...jest.requireActual('@grafana/ui/unstable'),
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
