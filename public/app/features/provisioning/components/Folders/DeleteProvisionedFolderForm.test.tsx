import { OpenFeatureProvider } from '@openfeature/react-sdk';
import { HttpResponse, delay, http } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { getTestFeatureFlagClient } from '@grafana/test-utils/unstable';
import { type Job, type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { type FolderDTO } from 'app/types/folders';

import {
  type ProvisionedFolderFormDataResult,
  useProvisionedFolderFormData,
} from '../../hooks/useProvisionedFolderFormData';
import { createJob, createRepository } from '../../mocks/factories';
import { setupProvisioningMswServer } from '../../mocks/server';

import { DeleteProvisionedFolderForm } from './DeleteProvisionedFolderForm';

setupProvisioningMswServer();

const mockNavigate = jest.fn();
jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../hooks/useProvisionedFolderFormData');

jest.mock('../../hooks/useGetResourceRepositoryView', () => ({
  ...jest.requireActual('../../hooks/useGetResourceRepositoryView'),
  useGetResourceRepositoryView: jest.fn(),
}));

jest.mock('app/features/browse-dashboards/components/BrowseActions/AffectedFolderContents', () => ({
  AffectedFolderContents: jest.fn(({ defaultMessage }) => (
    <div data-testid="affected-folder-contents">{defaultMessage}</div>
  )),
}));

jest.mock('../Shared/ResourceEditFormSharedFields', () => ({
  ResourceEditFormSharedFields: () => <div data-testid="shared-fields" />,
}));

const mockUseProvisionedFolderFormData = useProvisionedFolderFormData as jest.MockedFunction<
  typeof useProvisionedFolderFormData
>;

type DeleteJobBody = {
  message?: string;
  delete?: { ref?: string; resources?: Array<{ name: string; group: string; kind: string }> };
};

const successJob = (status: Record<string, unknown> = {}) =>
  createJob({ spec: { action: 'delete' }, status: { state: 'success', ...status } });

/** Captures the posted delete job and answers the job watch with `job`. */
function mockDeleteJob(job: Job = successJob()) {
  const posted: { repository?: string; body?: DeleteJobBody } = {};
  server.use(
    http.post(`${BASE}/repositories/:name/jobs`, async ({ request, params }) => {
      posted.repository = String(params.name);
      posted.body = (await request.json()) as DeleteJobBody;
      return HttpResponse.json(job);
    }),
    http.get(`${BASE}/jobs`, () => HttpResponse.json({ items: [job], metadata: { resourceVersion: '1' } })),
    // The finished job links back to its repository
    http.get(`${BASE}/repositories/:name`, ({ params }) =>
      HttpResponse.json(createRepository({ metadata: { name: String(params.name) } }))
    )
  );
  return posted;
}

const mockParentFolder: FolderDTO = {
  id: 1,
  uid: 'folder-uid',
  title: 'Test Folder',
  url: '/dashboards/f/folder-uid/test-folder',
  hasAcl: false,
  canSave: true,
  canEdit: true,
  canAdmin: true,
  canDelete: true,
  createdBy: '',
  created: '',
  updatedBy: '',
  updated: '',
  version: 1,
  parentUid: 'parent-folder-uid',
};

const mockRepository: RepositoryView = {
  name: 'test-repo',
  target: 'folder' as const,
  title: 'Test Repository',
  type: 'git' as const,
  branch: 'main',
  workflows: [],
};

const mockFolder = {
  metadata: {
    name: 'test-folder',
    annotations: {
      'grafana.app/sourcePath': 'folders/test-folder.json',
    },
  },
  spec: {
    title: 'Test Folder',
  },
  status: {},
};

const mockFormData = {
  repo: 'test-repo',
  path: 'folders/test-folder.json',
  ref: 'main',
  comment: '',
  title: 'Test Folder',
};

const defaultHookData: ProvisionedFolderFormDataResult = {
  repository: mockRepository,
  folder: mockFolder,
  initialValues: mockFormData,
  isReadOnlyRepo: false,
  isMissingRepo: false,
  canPushToConfiguredBranch: true,
  isLoading: false,
};

function setup(hookData = defaultHookData, job: Job = successJob()) {
  const posted = mockDeleteJob(job);
  mockUseProvisionedFolderFormData.mockReturnValue(hookData as ReturnType<typeof useProvisionedFolderFormData>);

  const onDismiss = jest.fn();
  const renderResult = render(
    <OpenFeatureProvider client={getTestFeatureFlagClient()}>
      <DeleteProvisionedFolderForm parentFolder={mockParentFolder} onDismiss={onDismiss} />
    </OpenFeatureProvider>
  );

  const clickDeleteButton = async () => {
    await renderResult.user.click(screen.getByRole('button', { name: /delete/i }));
  };

  return {
    ...renderResult,
    onDismiss,
    posted,
    clickDeleteButton,
  };
}

describe('DeleteProvisionedFolderForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render component correctly ', () => {
      setup();
      // delete warning and descendant count
      expect(screen.getByText(/This will delete this folder and all its descendants/)).toBeInTheDocument();
      expect(screen.getByTestId('affected-folder-contents')).toBeInTheDocument();

      // delete and cancel buttons
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should not render the form when the repository is missing', () => {
      setup({ ...defaultHookData, repository: undefined, initialValues: undefined, isMissingRepo: true });
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    it('should call createJob with correct parameters when deleting on the configured branch', async () => {
      const { posted, clickDeleteButton } = setup();

      await clickDeleteButton();

      await waitFor(() => expect(posted.body).toBeDefined());
      expect(posted.repository).toBe('test-repo');
      // The configured branch omits ref; the job names the folder, so authorization runs against that resource
      expect(posted.body).toEqual({
        action: 'delete',
        message: 'Delete folder: Test Folder',
        delete: {
          resources: [{ name: 'folder-uid', group: 'folder.grafana.app', kind: 'Folder' }],
        },
      });
    });

    it('sends the custom commit message and the ref when deleting on a new branch', async () => {
      const customFormData = {
        ...mockFormData,
        ref: 'feature-branch',
        comment: 'Custom delete message',
      };
      const { posted, clickDeleteButton } = setup({ ...defaultHookData, initialValues: customFormData });

      await clickDeleteButton();

      await waitFor(() => expect(posted.body).toBeDefined());
      expect(posted.body).toEqual(
        expect.objectContaining({
          message: 'Custom delete message',
          delete: expect.objectContaining({ ref: 'feature-branch' }),
        })
      );
    });

    it('renders the message from the repo commit template when comment is empty', async () => {
      const { posted, clickDeleteButton } = setup({
        ...defaultHookData,
        repository: {
          ...defaultHookData.repository!,
          commit: { singleResourceMessageTemplate: 'chore({{resourceKind}}s): {{action}} {{title}}' },
        },
        initialValues: { ...mockFormData, ref: 'feature-branch', comment: '' },
      });

      await clickDeleteButton();

      await waitFor(() => expect(posted.body).toBeDefined());
      expect(posted.body!.message).toBe('chore(folders): delete Test Folder');
    });

    it('should not submit if repository name is missing', async () => {
      const { posted, clickDeleteButton } = setup({ ...defaultHookData, repository: undefined });

      await clickDeleteButton();

      expect(await screen.findByText('Missing required fields')).toBeInTheDocument();
      expect(posted.body).toBeUndefined();
    });
  });

  describe('loading state', () => {
    it('should show loading text and disable button while the job is being created', async () => {
      const { clickDeleteButton } = setup();
      server.use(
        http.post(`${BASE}/repositories/:name/jobs`, async () => {
          await delay(200);
          return HttpResponse.json(successJob());
        })
      );

      await clickDeleteButton();

      expect(await screen.findByRole('button', { name: /deleting/i })).toBeDisabled();
    });
  });

  describe('success handling', () => {
    it('redirects to the dashboard list with the PR link once a branch delete job finishes', async () => {
      const { onDismiss, clickDeleteButton } = setup(
        { ...defaultHookData, initialValues: { ...mockFormData, ref: 'feature-branch' } },
        successJob({ url: { newPullRequestURL: 'https://github.com/test/repo/pull/new' } })
      );

      await clickDeleteButton();

      await waitFor(() => {
        const expectedParams = new URLSearchParams();
        expectedParams.set('new_pull_request_url', 'https://github.com/test/repo/pull/new');
        expectedParams.set('repo_type', 'git');
        expectedParams.set('action', 'delete');
        const expectedUrl = `/dashboards?${expectedParams.toString()}`;

        expect(mockNavigate).toHaveBeenCalledWith(expectedUrl);
      });
      expect(onDismiss).toHaveBeenCalled();
    });

    it('redirects to the dashboard list once a configured-branch delete job finishes', async () => {
      const { onDismiss, clickDeleteButton } = setup();

      await clickDeleteButton();

      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboards'));
      expect(onDismiss).toHaveBeenCalled();
    });

    it('redirects with the PR title captured at submission after the refs list the new branch', async () => {
      // Creating the job refetches the refs. Once they include the branch the live PR title clears
      // (the branch is no longer "new"), so the redirect must use what the form was submitted with.
      let refs = [{ name: 'main' }];
      server.use(http.get(`${BASE}/repositories/:name/refs`, () => HttpResponse.json({ items: refs })));
      const { posted, clickDeleteButton } = setup(
        {
          ...defaultHookData,
          repository: {
            ...mockRepository,
            workflows: ['branch', 'write'],
            pullRequest: { titleTemplate: '{{action}}: {{title}}' },
          },
          initialValues: { ...mockFormData, ref: 'feature-branch' },
        },
        successJob({ url: { newPullRequestURL: 'https://github.com/test/repo/pull/new' } })
      );
      server.use(
        http.post(`${BASE}/repositories/:name/jobs`, async ({ request }) => {
          posted.body = (await request.json()) as DeleteJobBody;
          refs = [{ name: 'main' }, { name: 'feature-branch' }];
          return HttpResponse.json(successJob({ url: { newPullRequestURL: 'https://github.com/test/repo/pull/new' } }));
        })
      );

      await clickDeleteButton();

      await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
      const url: string = mockNavigate.mock.calls.at(-1)[0];
      expect(new URLSearchParams(url.split('?')[1]).get('pr_title')).toBe('delete: Test Folder');
    });
  });

  describe('error handling', () => {
    it('should show the API error in an alert when the job cannot be created', async () => {
      const { onDismiss, clickDeleteButton } = setup({
        ...defaultHookData,
        initialValues: { ...mockFormData, ref: 'feature-branch' },
      });
      server.use(
        http.post(`${BASE}/repositories/:name/jobs`, () => HttpResponse.json({ message: 'API Error' }, { status: 500 }))
      );

      await clickDeleteButton();

      // The form catches the error and surfaces it in an alert; it stays open
      expect(await screen.findByText('API Error')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('shows the job error instead of a blank drawer when the job lookup fails', async () => {
      const { onDismiss, clickDeleteButton } = setup();
      server.use(http.get(`${BASE}/jobs`, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));

      await clickDeleteButton();

      expect(await screen.findByRole('alert')).toHaveTextContent('Error fetching active job');
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(onDismiss).not.toHaveBeenCalled();
    });
  });
});
