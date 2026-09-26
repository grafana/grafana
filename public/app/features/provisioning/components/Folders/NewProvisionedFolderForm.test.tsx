import { HttpResponse, delay, http } from 'msw';
import { act, render, screen, waitFor } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';
import { usePullRequestParam } from 'app/features/provisioning/hooks/usePullRequestParam';
import { configureStore } from 'app/store/configureStore';

import { RepoViewStatus, type RepositoryViewData } from '../../hooks/useGetResourceRepositoryView';
import { setupProvisioningMswServer } from '../../mocks/server';

import { NewProvisionedFolderForm } from './NewProvisionedFolderForm';

setupProvisioningMswServer();

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    config: {
      ...actual.config,
    },
  };
});

jest.mock('app/features/manage-dashboards/services/ValidationSrv', () => ({
  validationSrv: {
    validateNewFolderName: jest.fn(),
  },
}));
jest.mock('../../hooks/usePRBranch', () => ({
  usePRBranch: jest.fn().mockReturnValue(undefined),
}));

jest.mock('../../hooks/useLastBranch', () => ({
  useLastBranch: jest.fn().mockReturnValue({
    getLastBranch: jest.fn().mockReturnValue(undefined),
    setLastBranch: jest.fn(),
  }),
}));

jest.mock('../../hooks/useGetRepositoryFolders', () => ({
  useGetRepositoryFolders: jest.fn().mockReturnValue({ options: [], loading: false, error: null }),
}));

jest.mock('app/features/provisioning/hooks/usePullRequestParam', () => ({
  usePullRequestParam: jest.fn(),
}));
jest.mock('react-router-dom-v5-compat', () => {
  const actual = jest.requireActual('react-router-dom-v5-compat');
  return {
    ...actual,
    useNavigate: () => jest.fn(),
  };
});

interface Props {
  onDismiss?: () => void;
}

function setup(props: Partial<Props> = {}, view: RepositoryViewData = mockView) {
  const defaultProps: Props = {
    onDismiss: jest.fn(),
    ...props,
  };

  return {
    ...render(<NewProvisionedFolderForm {...defaultProps} view={view} />),
    props: defaultProps,
  };
}

const mockView: RepositoryViewData = {
  repository: {
    name: 'test-repo',
    title: 'Test Repository',
    type: 'github',
    branch: 'main',
    workflows: ['write', 'branch'],
    target: 'folder',
  },
  isReadOnlyRepo: false,
  folder: {
    metadata: {
      annotations: {
        'grafana.app/sourcePath': 'dashboards',
      },
    },
    spec: {
      title: '',
    },
  },
  isInstanceManaged: false,
  isMissingRepo: false,
  status: RepoViewStatus.Ready,
};

function requireCapturedRequest(capturedRequest: { url: URL; body: unknown } | null): { url: URL; body: unknown } {
  expect(capturedRequest).not.toBeNull();
  return capturedRequest as { url: URL; body: unknown };
}

describe('NewProvisionedFolderForm', () => {
  let capturedRequest: { url: URL; body: unknown } | null = null;

  beforeEach(() => {
    capturedRequest = null;
    jest.clearAllMocks();
    (usePullRequestParam as jest.Mock).mockReturnValue({});
    (validationSrv.validateNewFolderName as jest.Mock).mockResolvedValue(true);
  });

  it('should render the form with correct fields', async () => {
    setup();

    expect(await screen.findByRole('textbox', { name: /folder name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /comment/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /branch/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^create$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('should show a spinner while repository data is loading', async () => {
    setup(
      {},
      {
        ...mockView,
        repository: undefined,
        isLoading: true,
        status: RepoViewStatus.Loading,
      }
    );
    expect(await screen.findByTestId('Spinner')).toBeInTheDocument();
    expect(screen.queryByLabelText('Repository not found')).not.toBeInTheDocument();
  });

  it('should show error when repository is not found', async () => {
    setup(
      {},
      {
        ...mockView,
        repository: undefined,
        isMissingRepo: true,
      }
    );
    expect(await screen.findByLabelText('Repository not found')).toBeInTheDocument();
  });

  it('should show branch field for git repositories', async () => {
    setup();

    expect(await screen.findByRole('combobox', { name: /branch/i })).toBeInTheDocument();
  });

  it('should validate branch name', async () => {
    const { user } = setup();

    const branchInput = await screen.findByRole('combobox', { name: /branch/i });
    await user.click(branchInput);
    await user.type(branchInput, 'invalid//branch');
    await user.keyboard('{Enter}');

    const submitButton = screen.getByRole('button', { name: /^create$/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid branch name.')).toBeInTheDocument();
    });
  });

  it('should create folder successfully', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        capturedRequest = { url, body: await request.json() };
        return HttpResponse.json({
          resource: { upsert: { metadata: { name: 'new-folder' } } },
        });
      })
    );

    const { user, props } = setup();

    const folderNameInput = await screen.findByRole('textbox', { name: /folder name/i });
    const commentInput = screen.getByRole('textbox', { name: /comment/i });

    await user.clear(folderNameInput);
    await user.type(folderNameInput, 'New Test Folder');

    await user.clear(commentInput);
    await user.type(commentInput, 'Creating a new test folder');

    const submitButton = screen.getByRole('button', { name: /^create$/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    const request = requireCapturedRequest(capturedRequest);
    expect(request.url.pathname).toContain('/repositories/test-repo/files/dashboards/New%20Test%20Folder/');
    expect(request.url.searchParams.get('message')).toBe('Creating a new test folder');
    expect(request.body).toEqual({ title: 'New Test Folder', type: 'folder' });

    // The real request handler dismisses the form after a successful save
    await waitFor(() => {
      expect(props.onDismiss).toHaveBeenCalled();
    });
  });

  it('should not produce double slashes when folder annotation has trailing slash', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        capturedRequest = { url, body: await request.json() };
        return HttpResponse.json({
          resource: { upsert: { metadata: { name: 'new-folder' } } },
        });
      })
    );

    const viewWithTrailingSlash = {
      ...mockView,
      folder: {
        metadata: {
          annotations: {
            'grafana.app/sourcePath': 'dashboards/',
          },
        },
        spec: {
          title: '',
        },
      },
    };

    const { user } = setup({}, viewWithTrailingSlash);

    const folderNameInput = await screen.findByRole('textbox', { name: /folder name/i });
    await user.clear(folderNameInput);
    await user.type(folderNameInput, 'New Folder');

    const submitButton = screen.getByRole('button', { name: /^create$/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    const request = requireCapturedRequest(capturedRequest);
    expect(request.url.pathname).not.toContain('//');
    expect(request.url.pathname).toContain('/dashboards/New%20Folder/');
  });

  it('should create folder with branch workflow', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        capturedRequest = { url, body: await request.json() };
        return HttpResponse.json({
          resource: { upsert: { metadata: { name: 'new-folder' } } },
        });
      })
    );
    const { user } = setup();

    const folderNameInput = await screen.findByRole('textbox', { name: /folder name/i });
    await user.clear(folderNameInput);
    await user.type(folderNameInput, 'Branch Folder');

    // A new branch name moves the form off the configured branch, onto the branch workflow
    await user.type(screen.getByRole('combobox', { name: /branch/i }), 'feature/new-folder{Enter}');

    const submitButton = screen.getByRole('button', { name: /^create$/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    const request = requireCapturedRequest(capturedRequest);
    expect(request.url.pathname).toContain('/repositories/test-repo/files/');
    expect(request.url.pathname).toContain('Branch%20Folder');
    expect(request.url.searchParams.get('ref')).toBe('feature/new-folder');
    expect(request.url.searchParams.get('message')).toBe('Create folder: Branch Folder');
    expect(request.body).toEqual({ title: 'Branch Folder', type: 'folder' });
  });

  it('renders the message from the repo commit template when comment is empty', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        capturedRequest = { url, body: await request.json() };
        return HttpResponse.json({
          resource: { upsert: { metadata: { name: 'new-folder' } } },
        });
      })
    );
    const { user } = setup(
      {},
      {
        ...mockView,
        repository: {
          ...mockView.repository!,
          commit: { singleResourceMessageTemplate: 'chore({{resourceKind}}s): {{action}} {{title}}' },
        },
      }
    );

    const folderNameInput = await screen.findByRole('textbox', { name: /folder name/i });
    await user.clear(folderNameInput);
    await user.type(folderNameInput, 'Templated Folder');

    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    const request = requireCapturedRequest(capturedRequest);
    expect(request.url.searchParams.get('message')).toBe('chore(folders): create Templated Folder');
  });

  it('should send correct request body and show the error when folder creation fails', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        capturedRequest = { url, body: await request.json() };
        return HttpResponse.json({ message: 'Failed to create folder' }, { status: 500 });
      })
    );

    const { user, props } = setup();

    const folderNameInput = await screen.findByRole('textbox', { name: /folder name/i });
    await user.clear(folderNameInput);
    await user.type(folderNameInput, 'Error Folder');

    const submitButton = screen.getByRole('button', { name: /^create$/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(capturedRequest).not.toBeNull();
    });

    const request = requireCapturedRequest(capturedRequest);
    expect(request.url.pathname).toContain('/repositories/test-repo/files/');
    expect(request.url.pathname).toContain('Error%20Folder');
    expect(request.url.searchParams.get('message')).toBe('Create folder: Error Folder');
    expect(request.body).toEqual({ title: 'Error Folder', type: 'folder' });

    // The form catches the error and surfaces it in an alert; it stays open
    expect(await screen.findByText('Failed to create folder')).toBeInTheDocument();
    expect(props.onDismiss).not.toHaveBeenCalled();
  });

  it('should disable create button when form is submitting', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async () => {
        await delay('infinite');
        return HttpResponse.json({});
      })
    );

    const { user } = setup();

    const folderNameInput = await screen.findByRole('textbox', { name: /folder name/i });
    await user.clear(folderNameInput);
    await user.type(folderNameInput, 'Test Folder');

    const submitButton = screen.getByRole('button', { name: /^create$/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: /creating/i })).toHaveTextContent('Creating...');
  });

  it('should show PR link when PR URL is available', async () => {
    (usePullRequestParam as jest.Mock).mockReturnValue({ prURL: 'https://github.com/grafana/grafana/pull/1234' });

    setup();

    expect(await screen.findByText('Pull request created')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveTextContent('https://github.com/grafana/grafana/pull/1234');
  });

  it('should call onDismiss when cancel button is clicked', async () => {
    const { user, props } = setup();

    const cancelButton = await screen.findByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(props.onDismiss).toHaveBeenCalled();
  });

  describe('at the root of a folderless repository', () => {
    const folderlessView: RepositoryViewData = {
      ...mockView,
      repository: { ...mockView.repository!, name: 'folderless-repo', target: 'folderless' },
      // No parent folder, so no source path to nest under
      folder: undefined,
    };

    beforeEach(() => {
      server.use(
        http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
          capturedRequest = { url: new URL(request.url), body: await request.json() };
          return HttpResponse.json({ resource: { upsert: { metadata: { name: 'new-folder' } } } });
        })
      );
    });

    it('commits the folder at the repository root, with no directory prefix', async () => {
      const { user } = setup({}, folderlessView);

      const folderNameInput = await screen.findByRole('textbox', { name: /folder name/i });
      await user.type(folderNameInput, 'My Team');
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() => expect(capturedRequest).not.toBeNull());
      const request = requireCapturedRequest(capturedRequest);
      expect(request.url.pathname).toBe(
        '/apis/provisioning.grafana.app/v0alpha1/namespaces/default/repositories/folderless-repo/files/My%20Team/'
      );
      expect(request.url.searchParams.get('message')).toBe('Create folder: My Team');
      expect(request.body).toEqual({ title: 'My Team', type: 'folder' });
    });

    it('reloads the dashboards root list, so the new folder shows there', async () => {
      const store = configureStore();
      const { user } = render(<NewProvisionedFolderForm view={folderlessView} onDismiss={jest.fn()} />, { store });

      await user.type(await screen.findByRole('textbox', { name: /folder name/i }), 'My Team');
      await user.click(screen.getByRole('button', { name: /^create$/i }));

      await waitFor(() => expect(store.getState().browseDashboards.rootItems).toBeDefined());
    });
  });

  describe('when the parent folder has no usable repository', () => {
    it('names the deleted repository as the reason, rather than reporting none was found', async () => {
      setup(
        {},
        {
          ...mockView,
          repository: undefined,
          isMissingRepo: true,
          status: RepoViewStatus.Orphaned,
        }
      );

      expect(await screen.findByText('Provisioning repository no longer exists')).toBeInTheDocument();
      expect(screen.queryByLabelText('Repository not found')).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: /folder name/i })).not.toBeInTheDocument();
    });

    it('reports a failed lookup as a failure, rather than as an unprovisioned location', async () => {
      setup(
        {},
        {
          ...mockView,
          repository: undefined,
          isMissingRepo: true,
          status: RepoViewStatus.Error,
          error: { data: { message: 'settings unavailable' } },
        }
      );

      expect(await screen.findByText('Error loading form')).toBeInTheDocument();
      expect(screen.getByText('settings unavailable')).toBeInTheDocument();
      expect(screen.queryByLabelText('Repository not found')).not.toBeInTheDocument();
    });
  });

  // Repository titles and source paths routinely contain "/", which must not reach the page HTML-escaped
  it.each([
    { sourcePath: 'dashboards/team', text: 'Will be created in owner/repo under dashboards/team' },
    { sourcePath: undefined, text: 'Will be created at the root of owner/repo' },
  ])('shows "$text" verbatim', async ({ sourcePath, text }) => {
    setup(
      {},
      {
        ...mockView,
        repository: { ...mockView.repository!, title: 'owner/repo' },
        folder: {
          ...mockView.folder!,
          metadata: { annotations: sourcePath ? { 'grafana.app/sourcePath': sourcePath } : {} },
        },
      }
    );

    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it('should show read-only alert when repository has no workflows', async () => {
    setup(
      {},
      {
        ...mockView,
        repository: {
          name: 'test-repo',
          title: 'Test Repository',
          type: 'github',
          workflows: [],
          target: 'folder',
        },
      }
    );

    expect(await screen.findByText('This repository is read only')).toBeInTheDocument();
  });
});

describe('NewProvisionedFolderForm commit message template', () => {
  let capturedRequest: { url: URL; body: unknown } | null = null;

  beforeEach(() => {
    capturedRequest = null;
    setTestFlags({ 'provisioning.gitConventions': true });
  });

  afterEach(async () => {
    // setTestFlags fires OpenFeature events that update mounted components, so reset within act().
    await act(async () => {
      setTestFlags({});
    });
  });

  it('pre-fills Comment from the repository template', async () => {
    const { user } = setup(
      {},
      {
        ...mockView,
        repository: {
          ...mockView.repository!,
          commit: { singleResourceMessageTemplate: 'feat({{resourceKind}}s): {{action}} {{title}}' },
        },
      }
    );

    await user.type(await screen.findByRole('textbox', { name: /folder name/i }), 'Reports');

    const comment = screen.getByRole('textbox', { name: /comment/i });
    await waitFor(() => expect(comment).toHaveValue('feat(folders): create Reports'));
    expect(comment).not.toHaveAttribute('readonly');
  });

  it('sends the enforced template branch as ref when creating a folder', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        capturedRequest = { url: new URL(request.url), body: await request.json() };
        return HttpResponse.json({ resource: { upsert: { metadata: { name: 'new-folder' } } } });
      })
    );

    const { user } = setup(
      {},
      {
        ...mockView,
        repository: {
          ...mockView.repository!,
          // write is the default workflow, so only the enforcement can move the form onto branch
          workflows: ['write', 'branch'],
          branchOptions: { enforceTemplate: true, nameTemplate: 'grafana/enforced-folder' },
        },
      }
    );

    const folderNameInput = await screen.findByRole('textbox', { name: /folder name/i });
    await user.clear(folderNameInput);
    await user.type(folderNameInput, 'Enforced Folder');

    // The branch field is read-only and pre-filled from the template.
    const branch = await screen.findByRole('textbox', { name: /branch/i });
    await waitFor(() => expect(branch).toHaveValue('grafana/enforced-folder'));

    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => expect(capturedRequest).not.toBeNull());
    expect(requireCapturedRequest(capturedRequest).url.searchParams.get('ref')).toBe('grafana/enforced-folder');
  });
});
