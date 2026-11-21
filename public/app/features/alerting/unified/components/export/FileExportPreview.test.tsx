import { language } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import saveAs from 'file-saver';
import { type Props } from 'react-virtualized-auto-sizer';

import { FileExportPreview } from './FileExportPreview';
import { type ExportFormats } from './providers';

jest.mock('file-saver', () => ({ __esModule: true, default: jest.fn() }));

let mockHeight = 600;
jest.mock('react-virtualized-auto-sizer', () => ({
  __esModule: true,
  default: ({ children }: Props) =>
    children({ height: mockHeight, scaledHeight: mockHeight, width: 1, scaledWidth: 1 }),
}));

const exportCases: Array<{ format: ExportFormats; raw: string; preview: string }> = [
  { format: 'json', raw: '{"apiVersion":1}', preview: '{\n    "apiVersion": 1\n}' },
  { format: 'yaml', raw: 'apiVersion: 1\n', preview: 'apiVersion: 1\n' },
  {
    format: 'hcl',
    raw: 'resource "grafana_rule_group" "alerts" {\n  name = "Alerts"\n}\n',
    preview: 'resource "grafana_rule_group" "alerts" {\n  name = "Alerts"\n}\n',
  },
];

beforeEach(() => {
  mockHeight = 600;
  jest.clearAllMocks();
});

const secureContext = Object.getOwnPropertyDescriptor(window, 'isSecureContext');
beforeAll(() => Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true }));
afterAll(() => {
  if (secureContext) {
    Object.defineProperty(window, 'isSecureContext', secureContext);
  } else {
    Reflect.deleteProperty(window, 'isSecureContext');
  }
});

it.each(exportCases)(
  'shows a read-only $format preview and exports the original content',
  async ({ format, raw, preview }) => {
    const user = userEvent.setup();
    render(<FileExportPreview format={format} textDefinition={raw} downloadFileName="alerts" onClose={jest.fn()} />);

    const editor = await screen.findByRole('textbox', { name: 'Export preview' });
    const view = EditorView.findFromDOM(editor)!;
    await waitFor(() => expect(view.state.facet(language)?.name).toBe(format));

    expect(view.state.doc.toString()).toBe(preview);
    expect(view.state.readOnly).toBe(true);
    expect(view.dom).toHaveStyle({ height: '600px' });

    await user.click(editor);
    await user.keyboard('{Control>}a{/Control}{Backspace}changed');
    expect(view.state.doc.toString()).toBe(preview);

    await user.click(screen.getByRole('button', { name: 'Copy code' }));
    await waitFor(async () => expect(await navigator.clipboard.readText()).toBe(raw));

    await user.click(screen.getByRole('button', { name: 'Download' }));
    const [blob, filename] = jest.mocked(saveAs).mock.calls[0];
    expect(filename).toBe(`alerts.${format}`);
    expect((blob as Blob).type).toBe(`application/${format};charset=utf-8`);
    expect(await (blob as Blob).text()).toBe(raw);
  }
);

it('resizes the preview when the available height changes', async () => {
  const props = {
    format: 'yaml' as const,
    textDefinition: 'apiVersion: 1',
    downloadFileName: 'alerts',
    onClose: jest.fn(),
  };
  const { rerender } = render(<FileExportPreview {...props} />);
  const editor = await screen.findByRole('textbox', { name: 'Export preview' });
  const view = EditorView.findFromDOM(editor)!;
  expect(view.dom).toHaveStyle({ height: '600px' });

  mockHeight = 350;
  rerender(<FileExportPreview {...props} />);

  await waitFor(() => expect(view.dom).toHaveStyle({ height: '350px' }));
  expect(view.state.doc.toString()).toBe('apiVersion: 1');
});
