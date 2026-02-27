import { HttpResponse, delay, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { getAppEvents } from '@grafana/runtime';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';
import { usePullRequestParam } from 'app/features/provisioning/hooks/usePullRequestParam';
import { FolderDTO } from 'app/types/folders';

import {
  ProvisionedFolderFormDataResult,
  useProvisionedFolderFormData,
} from '../../hooks/useProvisionedFolderFormData';
import { setupProvisioningMswServer } from '../../mocks/server';

import { NewProvisionedFolderForm } from './NewProvisionedFolderForm';

setupProvisioningMswServer();

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    getAppEvents: jest.fn(),
    config: {
      ...actual.config,
    },
  };
});

jest.mock('../../hooks/useProvisionedRequestHandler', () => ({
  useProvisionedRequestHandler: jest.fn(),
}));

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

jest.mock('../../hooks/useProvisionedFolderFormData', () => ({
  useProvisionedFolderFormData: jest.fn(),
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
  parentFolder?: FolderDTO;
}

function setup(props: Partial<Props> = {}, hookData = mockHookData) {
  const defaultProps: Props = {
    onDismiss: jest.fn(),
    parentFolder: {
      id: 1,
      uid: 'folder-uid',
      title: 'Parent Folder',
      url: '/dashboards/f/folder-uid',
      hasAcl: false,
      canSave: true,
      canEdit: true,
      canAdmin: true,
      canDelete: true,
      repository: {
        name: 'test-repo',
        type: 'github',
      },
    } as unknown as FolderDTO,
    ...props,
  };

  (useProvisionedFolderFormData as jest.Mock).mockReturnValue(hookData);

  return {
    ...render(<NewProvisionedFolderForm {...defaultProps} />),
    props: defaultProps,
  };
}

const mockHookData: ProvisionedFolderFormDataResult = {
  repository: {
    name: 'test-repo',
    title: 'Test Repository',
    type: 'github',
    workflows: ['write', 'branch'],
    target: 'folder',
  },
  isReadOnlyRepo: false,
  folder: {
    metadata: {
      annotations: {
        'grafana.app/sourcePath': '/dashboards',
      },
    },
    spec: {
      title: '',
    },
  },
  canPushToConfiguredBranch: true,
  initialValues: {
    title: '',
    comment: '',
    ref: 'folder/test-timestamp',
    repo: 'test-repo',
    path: '/dashboards',
    workflow: 'write',
  },
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
    (getAppEvents as jest.Mock).mockReturnValue({ publish: jest.fn() });
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

  it('should return null when initialValues is not available', async () => {
    setup(
      {},
      {
        ...mockHookData,
        initialValues: undefined,
      }
    );
    expect(await screen.findByLabelText('Repository not found')).toBeInTheDocument();
  });

  it('should show error when repository is not found', async () => {
    setup(
      {},
      {
        ...mockHookData,
        repository: undefined,
        initialValues: undefined,
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

    const { user } = setup();

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
    expect(request.url.pathname).toContain('/repositories/test-repo/files/');
    expect(request.url.pathname).toContain('New%20Test%20Folder');
    expect(request.url.searchParams.get('message')).toBe('Creating a new test folder');
    expect(request.body).toEqual({ title: 'New Test Folder', type: 'folder' });
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

    const { user } = setup(
      {},
      {
        ...mockHookData,
        initialValues: {
          ...mockHookData.initialValues!,
          ref: '',
          workflow: 'branch',
        },
      }
    );

    const folderNameInput = await screen.findByRole('textbox', { name: /folder name/i });
    await user.clear(folderNameInput);
    await user.type(folderNameInput, 'Branch Folder');

    const branchInput = screen.getByRole('combobox', { name: /branch/i });
    await user.click(branchInput);
    await user.clear(branchInput);
    await user.type(branchInput, 'feature/new-folder');
    await user.keyboard('{Enter}');

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

  it('should send correct request body when folder creation fails', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        capturedRequest = { url, body: await request.json() };
        return HttpResponse.json({ message: 'Failed to create folder' }, { status: 500 });
      })
    );

    const { user } = setup();

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

  it('should show read-only alert when repository has no workflows', async () => {
    setup(
      {},
      {
        ...mockHookData,
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
