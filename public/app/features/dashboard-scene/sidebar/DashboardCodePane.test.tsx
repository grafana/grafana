/** @jest-environment-options {"customExportConditions": ["@grafana-app/source", "node", "node-addons"]} */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';

import { Sidebar, useSidebar } from '@grafana/ui';

import { DashboardSchemaEditor } from '../v2schema/DashboardSchemaEditor';

import { DashboardCodePane } from './DashboardCodePane';
import { applyJsonToDashboard, getDashboardDiffTexts, getDashboardResourceText } from './codePaneUtils';

jest.mock('../utils/utils', () => ({
  getDashboardSceneFor: jest.fn(() => ({})),
}));

jest.mock('../v2schema/DashboardSchemaEditor', () => ({
  DashboardSchemaEditor: jest.fn(
    ({
      headerActions,
      headerLeftActions,
      contentOverride,
      onParseErrorChange,
    }: {
      headerActions?: ReactNode;
      headerLeftActions?: ReactNode;
      contentOverride?: ReactNode;
      onParseErrorChange?: (hasParseError: boolean) => void;
    }) => (
      <div data-testid="schema-editor">
        {headerLeftActions}
        {headerActions}
        {contentOverride ?? <div data-testid="code-editor" />}
        <button data-testid="trigger-parse-error" onClick={() => onParseErrorChange?.(true)} />
      </div>
    )
  ),
}));

jest.mock('../v2schema/dashboardSchemaFetcher', () => ({
  fetchDashboardSchema: jest.fn().mockResolvedValue({
    type: 'object',
    required: ['spec'],
    properties: { spec: { type: 'object', required: ['title'], properties: { title: { type: 'string' } } } },
  }),
}));

// Shiki's ESM/WASM tooltip renderer cannot run in Jest's CommonJS environment.
jest.mock(require.resolve('codemirror-json-schema').replace('index.js', 'utils/markdown.js'), () => ({
  renderMarkdown: (text: string) => text,
}));

jest.mock('app/core/components/MonacoDiffEditor/MonacoDiffEditor', () => ({
  MonacoDiffEditor: () => <div data-testid="diff-viewer" />,
}));

jest.mock('./codePaneUtils', () => ({
  applyJsonToDashboard: jest.fn(() => ({ success: true })),
  getDashboardDiffTexts: jest.fn(),
  getDashboardResourceText: jest.fn(() => '{"spec":{}}'),
}));

function WrapSidebar({ children }: { children: React.ReactNode }) {
  const sidebarContext = useSidebar({});
  return <Sidebar contextValue={sidebarContext}>{children}</Sidebar>;
}

function setup() {
  const pane = new DashboardCodePane({});
  const Component = DashboardCodePane.Component;
  return render(
    <WrapSidebar>
      <Component model={pane} />
    </WrapSidebar>
  );
}

describe('DashboardCodePane', () => {
  beforeEach(() => {
    jest.mocked(getDashboardDiffTexts).mockReset();
    jest.mocked(getDashboardResourceText).mockReturnValue('{"spec":{}}');
  });

  it('renders the code editor and no diff by default', () => {
    setup();

    expect(screen.getByTestId('code-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument();
  });

  it('shows the diff in place of the code editor when the switch is turned on', async () => {
    jest.mocked(getDashboardDiffTexts).mockReturnValue({ original: 'a', current: 'b', migratedFromV1: false });
    setup();

    await userEvent.click(screen.getByRole('switch', { name: 'Show diff' }));

    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
    expect(screen.queryByTestId('code-editor')).not.toBeInTheDocument();
  });

  it('returns to the code editor when the switch is turned off again', async () => {
    jest.mocked(getDashboardDiffTexts).mockReturnValue({ original: 'a', current: 'b', migratedFromV1: false });
    setup();

    await userEvent.click(screen.getByRole('switch', { name: 'Show diff' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Show diff' }));

    expect(screen.getByTestId('code-editor')).toBeInTheDocument();
    expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no changes', async () => {
    jest.mocked(getDashboardDiffTexts).mockReturnValue({ original: 'a', current: 'a', migratedFromV1: false });
    setup();

    await userEvent.click(screen.getByRole('switch', { name: 'Show diff' }));

    expect(screen.getByText('No changes to show')).toBeInTheDocument();
    expect(screen.queryByTestId('diff-viewer')).not.toBeInTheDocument();
  });

  it('shows an unavailable message when no diff can be produced', async () => {
    jest.mocked(getDashboardDiffTexts).mockReturnValue(null);
    setup();

    await userEvent.click(screen.getByRole('switch', { name: 'Show diff' }));

    expect(screen.getByText('Cannot show changes')).toBeInTheDocument();
  });

  it('shows the inline/side-by-side selector only while the diff is shown', async () => {
    jest.mocked(getDashboardDiffTexts).mockReturnValue({ original: 'a', current: 'b', migratedFromV1: false });
    setup();

    expect(screen.queryByRole('radio', { name: 'Inline' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('switch', { name: 'Show diff' }));

    expect(screen.getByRole('radio', { name: 'Inline' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Side by side' })).toBeChecked();
  });

  it('disables the diff switch while the editor content is not valid JSON', () => {
    jest.mocked(getDashboardResourceText).mockReturnValue('not json {');
    setup();

    expect(screen.getByRole('switch', { name: 'Show diff' })).toBeDisabled();
  });

  it('disables the diff switch while the buffer has a syntax error', async () => {
    setup();

    await userEvent.click(screen.getByTestId('trigger-parse-error'));

    expect(screen.getByRole('switch', { name: 'Show diff' })).toBeDisabled();
  });

  it('renders a single editor instance while the modal is expanded', async () => {
    setup();

    await userEvent.click(screen.getByRole('button', { name: 'Expand editor' }));

    expect(screen.getAllByTestId('schema-editor')).toHaveLength(1);
  });

  it('shows a migration notice when the original was converted from v1', async () => {
    jest.mocked(getDashboardDiffTexts).mockReturnValue({ original: 'a', current: 'b', migratedFromV1: true });
    setup();

    await userEvent.click(screen.getByRole('switch', { name: 'Show diff' }));

    expect(screen.getByText(/migration to the new dashboard format/)).toBeInTheDocument();
    expect(screen.getByTestId('diff-viewer')).toBeInTheDocument();
  });
});

describe('DashboardCodePane CodeMirror editing', () => {
  const mockEditor = jest.mocked(DashboardSchemaEditor);
  const defaultEditorImplementation = mockEditor.getMockImplementation()!;

  beforeEach(() => {
    mockEditor.mockImplementation(jest.requireActual('../v2schema/DashboardSchemaEditor').DashboardSchemaEditor);
    jest.mocked(getDashboardResourceText).mockReturnValue('{"spec":{"title":"Original"}}');
    jest.mocked(applyJsonToDashboard).mockClear();
  });

  afterEach(() => {
    mockEditor.mockImplementation(defaultEditorImplementation);
  });

  it('applies current edits in the expanded editor and blocks invalid JSON/YAML', async () => {
    const user = userEvent.setup();
    setup();
    const apply = await screen.findByRole('button', { name: 'Apply changes' });
    await waitFor(() => expect(apply).toBeEnabled());
    await user.click(await screen.findByRole('textbox', { name: 'Dashboard schema' }));
    await user.keyboard('{Control>}a{/Control}');
    await user.paste('{"spec":{"title":"Edited"}}');
    await user.click(screen.getByRole('button', { name: 'Expand editor' }));
    expect(await screen.findByRole('textbox', { name: 'Dashboard schema' })).toHaveTextContent('Edited');
    const modal = within(screen.getByRole('dialog'));
    await waitFor(() => expect(modal.getByRole('button', { name: 'Apply changes' })).toBeEnabled());
    await user.click(modal.getByRole('button', { name: 'Apply changes' }));
    expect(applyJsonToDashboard).toHaveBeenLastCalledWith({}, '{"spec":{"title":"Edited"}}');
    await user.click(modal.getByRole('button', { name: 'Collapse editor' }));
    expect(await screen.findByRole('textbox', { name: 'Dashboard schema' })).toHaveTextContent('Edited');

    await user.click(screen.getByRole('textbox', { name: 'Dashboard schema' }));
    await user.keyboard('{Control>}a{/Control}');
    await user.paste('{');
    expect(screen.getByRole('button', { name: 'Apply changes' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Show diff' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'YAML' })).toBeDisabled();

    await user.keyboard('{Control>}a{/Control}');
    await user.paste('{"spec":{"title":"Edited"}}');
    await user.click(screen.getByRole('radio', { name: 'YAML' }));
    await user.click(await screen.findByRole('textbox', { name: 'Dashboard schema' }));
    await user.keyboard('{Control>}a{/Control}');
    await user.paste('spec:\n  title: 123');
    expect(screen.getByRole('button', { name: 'Apply changes' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'JSON' })).toBeEnabled();

    await user.keyboard('{Control>}a{/Control}');
    await user.paste('spec: [');
    expect(screen.getByRole('button', { name: 'Apply changes' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Show diff' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'JSON' })).toBeDisabled();

    await user.keyboard('{Control>}a{/Control}');
    await user.paste('spec:\n  title: YAML edit');
    expect(screen.getByRole('button', { name: 'Apply changes' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Apply changes' }));
    expect(applyJsonToDashboard).toHaveBeenLastCalledWith({}, '{\n  "spec": {\n    "title": "YAML edit"\n  }\n}');
    expect(screen.getByRole('switch', { name: 'Show diff' })).toBeEnabled();
  });
});
