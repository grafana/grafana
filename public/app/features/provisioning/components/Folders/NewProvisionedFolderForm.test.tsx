import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { render } from 'test/test-utils';

import { AppEvents } from '@grafana/data';
import { getAppEvents, locationService } from '@grafana/runtime';
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

const mockNavigate = jest.fn();
const mockLocation = {
  pathname: '/dashboards/f/folder-uid',
  search: '?tab=browse',
};

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    getAppEvents: jest.fn(),
    locationService: {
      partial: jest.fn(),
      getHistory: () => ({
        listen: jest.fn(),
      }),
    },
    config: {
      ...actual.config,
    },
  };
});

jest.mock('app/features/manage-dashboards/services/ValidationSrv', () => {
  return {
    validationSrv: {
      validateNewFolderName: jest.fn(),
    },
  };
});

// Mock the new hooks that depend on router context
jest.mock('../../hooks/usePRBranch', () => ({
  usePRBranch: jest.fn().mockReturnValue(undefined),
}));

jest.mock('../../hooks/useLastBranch', () => ({
  useLastBranch: jest.fn().mockReturnValue({
    getLastBranch: jest.fn().mockReturnValue(undefined),
    setLastBranch: jest.fn(),
  }),
}));

jest.mock('../../hooks/useProvisionedFolderFormData', () => {
  return {
    useProvisionedFolderFormData: jest.fn(),
  };
});

jest.mock('app/features/provisioning/hooks/usePullRequestParam', () => {
  return {
    usePullRequestParam: jest.fn(),
  };
});

jest.mock('react-router-dom-v5-compat', () => {
  const actual = jest.requireActual('react-router-dom-v5-compat');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
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

type CapturedCreateRequest = { url: URL; body: unknown };

function requireCapturedRequest(capturedRequest: CapturedCreateRequest | null): CapturedCreateRequest {
  expect(capturedRequest).not.toBeNull();
  return capturedRequest as CapturedCreateRequest;
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

describe('NewProvisionedFolderForm', () => {
  let capturedCreateRequest: CapturedCreateRequest | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedCreateRequest = null;
    mockLocation.pathname = '/dashboards/f/folder-uid';
    mockLocation.search = '?tab=browse';

    // Setup default mocks
    const mockAppEvents = {
      publish: jest.fn(),
    };
    (getAppEvents as jest.Mock).mockReturnValue(mockAppEvents);

    // Mock usePullRequestParam
    (usePullRequestParam as jest.Mock).mockReturnValue({});
    server.use(
      http.get(`${BASE}/repositories/:name/refs`, () =>
        HttpResponse.json({
          items: [{ name: 'main' }, { name: 'develop' }],
        })
      ),
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        capturedCreateRequest = { url, body: await request.json() };
        return HttpResponse.json({
          ref: url.searchParams.get('ref') ?? 'main',
          path: decodeURIComponent(url.pathname).split('/files/')[1] ?? '',
          resource: { upsert: { metadata: { name: 'new-folder' } } },
        });
      })
    );

    (validationSrv.validateNewFolderName as jest.Mock).mockResolvedValue(true);
  });

  it('should render the form with correct fields', () => {
    setup();

    // Check if form elements are rendered
    expect(screen.getByRole('textbox', { name: /folder name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /comment/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /branch/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^create$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('should return null when initialValues is not available', () => {
    setup(
      {},
      {
        ...mockHookData,
        initialValues: undefined,
      }
    );
    expect(screen.getByLabelText('Repository not found')).toBeInTheDocument();
  });

  it('should show error when repository is not found', () => {
    setup(
      {},
      {
        ...mockHookData,
        repository: undefined,
        initialValues: undefined,
      }
    );
    expect(screen.getByLabelText('Repository not found')).toBeInTheDocument();
  });

  it('should show branch field for git repositories', () => {
    setup();

    expect(screen.getByRole('combobox', { name: /branch/i })).toBeInTheDocument();
  });

  it('should validate branch name', async () => {
    const { user } = setup();

    // Enter invalid branch name
    const branchInput = screen.getByRole('combobox', { name: /branch/i });
    await user.click(branchInput);
    await user.type(branchInput, 'invalid//branch');
    await user.keyboard('{Enter}');

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /^create$/i });
    await user.click(submitButton);

    // Wait for validation error to appear
    await waitFor(() => {
      expect(screen.getByText('Invalid branch name.')).toBeInTheDocument();
    });
  });

  it('should create folder successfully', async () => {
    const { user, props } = setup();

    const folderNameInput = screen.getByRole('textbox', { name: /folder name/i });
    const commentInput = screen.getByRole('textbox', { name: /comment/i });

    await user.clear(folderNameInput);
    await user.type(folderNameInput, 'New Test Folder');

    await user.clear(commentInput);
    await user.type(commentInput, 'Creating a new test folder');

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /^create$/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(capturedCreateRequest).not.toBeNull();
    });
    const { url, body } = requireCapturedRequest(capturedCreateRequest);
    expect(decodeURIComponent(url.pathname)).toContain('/repositories/test-repo/files//dashboards/New Test Folder/');
    expect(url.searchParams.get('ref')).toBeNull();
    expect(url.searchParams.get('message')).toBe('Creating a new test folder');
    expect(body).toEqual({
      title: 'New Test Folder',
      type: 'folder',
    });

    // Check if onDismiss was called
    expect(props.onDismiss).toHaveBeenCalled();
  });

  it('should create folder with branch workflow', async () => {
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

    // Fill form
    const folderNameInput = screen.getByRole('textbox', { name: /folder name/i });
    await user.clear(folderNameInput);
    await user.type(folderNameInput, 'Branch Folder');

    // Enter branch name
    const branchInput = screen.getByRole('combobox', { name: /branch/i });
    await user.click(branchInput);
    await user.clear(branchInput);
    await user.type(branchInput, 'feature/new-folder');
    await user.keyboard('{Enter}');

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /^create$/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(capturedCreateRequest).not.toBeNull();
    });
    const { url, body } = requireCapturedRequest(capturedCreateRequest);
    expect(decodeURIComponent(url.pathname)).toContain('/repositories/test-repo/files//dashboards/Branch Folder/');
    expect(url.searchParams.get('ref')).toBe('feature/new-folder');
    expect(url.searchParams.get('message')).toBe('Create folder: Branch Folder');
    expect(body).toEqual({
      title: 'Branch Folder',
      type: 'folder',
    });
  });

  it('should show error when folder creation fails', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, () =>
        HttpResponse.json({ message: 'Failed to create folder' }, { status: 500 })
      )
    );

    const { user } = setup();

    // Fill form
    const folderNameInput = screen.getByRole('textbox', { name: /folder name/i });
    await user.clear(folderNameInput);
    await user.type(folderNameInput, 'Error Folder');

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /^create$/i });
    await user.click(submitButton);

    // Check if error alert was published
    await waitFor(() => {
      const appEvents = getAppEvents();
      expect(appEvents.publish).toHaveBeenCalled();
      const lastCallArgs = (appEvents.publish as jest.Mock).mock.calls.at(-1)?.[0];
      expect(lastCallArgs?.type).toBe(AppEvents.alertError.name);
      expect(lastCallArgs?.payload?.[0]).toBe('Error creating folder');
      expect(lastCallArgs?.payload?.[1]?.data?.message).toBe('Failed to create folder');
    });
  });

  it('should disable create button when form is submitting', async () => {
    setup();

    const createButton = screen.getByRole('button', { name: /^create$/i });
    expect(createButton).not.toBeDisabled();
  });

  it('should show PR link when PR URL is available', () => {
    (usePullRequestParam as jest.Mock).mockReturnValue({ prURL: 'https://github.com/grafana/grafana/pull/1234' });

    setup();

    // PR alert should be visible - use text content instead of role
    expect(screen.getByText('Pull request created')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveTextContent('https://github.com/grafana/grafana/pull/1234');
  });

  it('should keep user on current page for branch workflow success', async () => {
    server.use(
      http.post(`${BASE}/repositories/:name/files/*`, async ({ request }) => {
        const url = new URL(request.url);
        capturedCreateRequest = { url, body: await request.json() };
        return HttpResponse.json({
          ref: 'feature/new-folder',
          path: '/dashboards/Branch Folder/',
          urls: {
            newPullRequestURL: 'https://github.com/grafana/grafana/pull/5678',
          },
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
          ref: 'feature/new-folder',
          workflow: 'branch',
        },
      }
    );

    const folderNameInput = screen.getByRole('textbox', { name: /folder name/i });
    await user.clear(folderNameInput);
    await user.type(folderNameInput, 'Branch Folder');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(locationService.partial).toHaveBeenCalledWith(
        {
          new_pull_request_url: 'https://github.com/grafana/grafana/pull/5678',
          repo_type: 'github',
        },
        undefined
      );
    });
  });

  it('should call onDismiss when cancel button is clicked', async () => {
    const { user, props } = setup();

    // Click cancel button
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(props.onDismiss).toHaveBeenCalled();
  });

  it('should show read-only alert when repository has no workflows', () => {
    // Mock repository with empty workflows array
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

    // Read-only alert should be visible
    expect(screen.getByText('This repository is read only')).toBeInTheDocument();
  });
});
