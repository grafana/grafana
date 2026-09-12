import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { CodeMirrorEditorProps } from '@grafana/ui/unstable';

import { LivePublish } from './LivePublish';
import { MessagePublishMode } from './types';

jest.mock('@grafana/ui/unstable', () => ({
  ...jest.requireActual('@grafana/ui/unstable'),
  CodeMirrorEditor: ({ value, onChange }: CodeMirrorEditorProps) => (
    <textarea aria-label="Message to publish" value={value} onChange={(event) => onChange(event.currentTarget.value)} />
  ),
}));

it('preserves an unsaved draft across rerenders', async () => {
  const user = userEvent.setup();
  const props = {
    height: 200,
    mode: MessagePublishMode.JSON,
    body: { saved: true },
    onSave: jest.fn(),
  };
  const { rerender } = render(<LivePublish {...props} />);
  const editor = screen.getByRole('textbox', { name: 'Message to publish' });

  await user.clear(editor);
  await user.paste('{"draft":true}');
  rerender(<LivePublish {...props} />);

  expect(editor).toHaveValue('{"draft":true}');
  expect(props.onSave).not.toHaveBeenCalled();
});
