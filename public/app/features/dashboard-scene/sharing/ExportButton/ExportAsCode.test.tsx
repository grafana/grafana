import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Props as AutoSizerProps } from 'react-virtualized-auto-sizer';

import { type Dashboard } from '@grafana/schema';

import { ExportAsCode } from './ExportAsCode';

let mockAutoSizerHeight = 320;

jest.mock('react-virtualized-auto-sizer', () => ({
  __esModule: true,
  default: ({ children }: AutoSizerProps) =>
    children({
      height: mockAutoSizerHeight,
      scaledHeight: mockAutoSizerHeight,
      scaledWidth: 800,
      width: 800,
    }),
}));

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  CodeEditor: () => <div data-testid="monaco-editor" />,
}));

jest.mock('@grafana/ui/unstable', () => ({
  ...jest.requireActual('@grafana/ui/unstable'),
  __esModule: true,
  CodeMirrorEditor: ({
    value,
    language,
    height,
    readOnly,
  }: {
    value: string;
    language?: string;
    height?: string;
    readOnly?: boolean;
  }) => (
    <textarea
      data-testid="code-mirror-editor"
      data-height={height}
      data-language={language}
      readOnly={readOnly}
      value={value}
    />
  ),
}));

const dashboard = { title: 'Test dashboard' } as Dashboard;
const dashboardJson = '{\n  "title": "Test dashboard"\n}';
const dashboardYAML = 'title: Test dashboard\n';

function setup({ isViewingYAML = false, height = 320 } = {}) {
  mockAutoSizerHeight = height;

  const model = new ExportAsCode({ isViewingYAML });
  jest.spyOn(model, 'getExportableDashboardJson').mockResolvedValue({
    json: dashboard,
    hasLibraryPanels: false,
    initialSaveModelVersion: 'v1',
  });
  const onSaveAsFile = jest.spyOn(model, 'onSaveAsFile').mockResolvedValue();
  const onClipboardCopy = jest.spyOn(model, 'onClipboardCopy').mockResolvedValue();

  render(<model.Component model={model} />);

  return { onClipboardCopy, onSaveAsFile };
}

describe('ExportAsCode', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'execCommand', { configurable: true, value: jest.fn() });
  });

  it('renders autosized JSON in a read-only CodeMirror editor', async () => {
    setup({ height: 480 });

    const editor = await screen.findByTestId('code-mirror-editor');

    expect(editor).toHaveValue(dashboardJson);
    expect(editor).toHaveAttribute('data-language', 'json');
    expect(editor).toHaveAttribute('data-height', '480px');
    expect(editor).toHaveAttribute('readonly');
    expect(screen.queryByTestId('monaco-editor')).not.toBeInTheDocument();
  });

  it('renders YAML when the YAML format is selected', async () => {
    setup({ isViewingYAML: true });

    const editor = await screen.findByTestId('code-mirror-editor');

    expect(editor).toHaveValue(dashboardYAML);
    expect(editor).toHaveAttribute('data-language', 'yaml');
  });

  it('copies the rendered dashboard definition', async () => {
    const { onClipboardCopy } = setup();
    await screen.findByTestId('code-mirror-editor');

    await userEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));

    expect(onClipboardCopy).toHaveBeenCalledWith(dashboardJson);
  });

  it('preserves the dashboard download action', async () => {
    const { onSaveAsFile } = setup();
    await screen.findByTestId('code-mirror-editor');

    await userEvent.click(screen.getByRole('button', { name: 'Download file' }));

    expect(onSaveAsFile).toHaveBeenCalledTimes(1);
  });
});
