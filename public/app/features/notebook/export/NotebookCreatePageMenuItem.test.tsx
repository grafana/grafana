import { act, fireEvent, render, screen, waitFor } from 'test/test-utils';

import { useAssistant } from '@grafana/assistant';
import { config } from '@grafana/runtime';
import { useFlagDashboardNotebookCreatePage } from '@grafana/runtime/internal';
import { Menu } from '@grafana/ui';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';

import { NotebookAnalytics } from '../analytics/main';
import { defaultSpec as defaultNotebookSpec, type Spec as NotebookSpec } from '../types';

import { NotebookCreatePageMenuItem } from './NotebookCreatePageMenuItem';

jest.mock('../analytics/main', () => ({ NotebookAnalytics: { exported: jest.fn() } }));
jest.mock('@grafana/assistant', () => ({
  createAssistantContextItem: jest.fn((type, params) => ({ type, params })),
  useAssistant: jest.fn(),
}));
jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  useFlagDashboardNotebookCreatePage: jest.fn(),
}));

const mockUseAssistant = jest.mocked(useAssistant);
const mockUseCreatePageFlag = jest.mocked(useFlagDashboardNotebookCreatePage);
const mockOpenAssistant = jest.fn();
const mockExported = jest.mocked(NotebookAnalytics.exported);

function buildSpec(): NotebookSpec {
  return {
    ...defaultNotebookSpec(),
    title: 'Q2 latency regression',
    tags: [],
    elements: { md: { kind: 'Cell', spec: { content: { kind: 'Markdown', spec: { text: 'Findings' } } } } },
    layout: {
      kind: 'NotebookLayout',
      spec: {
        cells: [
          { kind: 'NotebookLayoutItem', spec: { element: { kind: 'ElementReference', name: 'md' }, source: 'user' } },
        ],
      },
    },
  };
}

function setup(flushPendingChanges: () => Promise<void> = async () => {}) {
  return render(
    <>
      <AppNotificationList />
      <Menu>
        <NotebookCreatePageMenuItem
          uid="nb1"
          getSpec={async () => buildSpec()}
          flushPendingChanges={flushPendingChanges}
        />
      </Menu>
    </>
  );
}

/** The parent's accessible name includes its children's text, hence the prefix match. */
const parent = () => screen.getByRole('menuitem', { name: /^Create page with Assistant/ });

// The submenu opens on hover. fireEvent rather than user.click for the child: moving the pointer
// onto it fires mouseLeave on the parent, which closes the submenu before the click lands. Inside an
// async act so the click's handler, which awaits, settles before the assertions.
async function choose(user: ReturnType<typeof setup>['user'], name: string) {
  await user.hover(parent());
  const child = await screen.findByRole('menuitem', { name });
  await act(async () => {
    fireEvent.click(child);
  });
}

describe('NotebookCreatePageMenuItem', () => {
  const originalAppUrl = config.appUrl;

  beforeEach(() => {
    jest.clearAllMocks();
    // notebookShareUrl resolves the share link against config.appUrl, which jest leaves unset.
    config.appUrl = 'https://host/';
    mockUseCreatePageFlag.mockReturnValue(true);
    mockUseAssistant.mockReturnValue({
      isLoading: false,
      isAvailable: true,
      openAssistant: mockOpenAssistant,
      closeAssistant: jest.fn(),
      toggleAssistant: jest.fn(),
    });
  });

  afterEach(() => {
    config.appUrl = originalAppUrl;
  });

  it('stays hidden while the feature is off', () => {
    mockUseCreatePageFlag.mockReturnValue(false);
    setup();

    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });

  it('stays hidden when the Assistant is unavailable', () => {
    mockUseAssistant.mockReturnValue({
      isLoading: false,
      isAvailable: false,
      openAssistant: undefined,
      closeAssistant: undefined,
      toggleAssistant: undefined,
    });
    setup();

    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });

  it('opens the Assistant with the notebook and a presentation prompt, after saving pending edits', async () => {
    const flushPendingChanges = jest.fn().mockResolvedValue(undefined);
    const { user } = setup(flushPendingChanges);

    await choose(user, 'Presentation');

    await waitFor(() => expect(mockOpenAssistant).toHaveBeenCalledTimes(1));
    const props = mockOpenAssistant.mock.calls[0][0];
    expect(props).toEqual(
      expect.objectContaining({
        mode: 'assistant',
        autoSend: true,
        prompt: expect.stringContaining('presentation'),
      })
    );
    expect(props.context).toHaveLength(1);
    expect(props.context[0].type).toBe('structured');
    expect(props.context[0].params.data).toEqual(
      expect.objectContaining({
        kind: 'notebook',
        uid: 'nb1',
        path: '/notebooks/nb1.nb',
        title: 'Q2 latency regression',
        markdown: expect.stringContaining('Findings'),
      })
    );
    expect(flushPendingChanges.mock.invocationCallOrder[0]).toBeLessThan(mockOpenAssistant.mock.invocationCallOrder[0]);
    expect(mockExported).toHaveBeenCalledWith('nb1', 'page', 'notebook_toolbar');
  });

  it('opens the Assistant with an exec summary prompt', async () => {
    const { user } = setup();

    await choose(user, 'Exec summary');

    await waitFor(() => expect(mockOpenAssistant).toHaveBeenCalledTimes(1));
    expect(mockOpenAssistant.mock.calls[0][0]).toEqual(
      expect.objectContaining({ prompt: expect.stringContaining('exec summary') })
    );
  });

  it('does not open the Assistant when the pending edits cannot be saved', async () => {
    const { user } = setup(async () => {
      throw new Error('The notebook was changed by someone else.');
    });

    await choose(user, 'Presentation');

    expect(await screen.findByText('Failed to export notebook')).toBeInTheDocument();
    expect(mockOpenAssistant).not.toHaveBeenCalled();
    expect(mockExported).not.toHaveBeenCalled();
  });
});
