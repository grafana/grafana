import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { PROVISIONING_API_BASE as BASE } from '@grafana/test-utils/handlers';
import server from '@grafana/test-utils/server';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import {
  AnnoKeyManagerAllowsEdits,
  AnnoKeyManagerIdentity,
  AnnoKeyManagerKind,
  ManagerKind,
} from 'app/features/apiserver/types';

import { setupProvisioningMswServer } from '../mocks/server';
import { type ManagedResource } from '../utils/managedResource';

import { ManagedResourceBreadcrumbBadge } from './ManagedResourceBreadcrumbBadge';

setupProvisioningMswServer();

/** Override the frontend settings endpoint that the repository lookup reads from. */
function mockRepository(workflows: RepositoryView['workflows']) {
  const repository: Partial<RepositoryView> = {
    name: 'my-repo',
    title: 'My Repo',
    target: 'folder',
    type: 'github',
    workflows,
  };
  server.use(http.get(`${BASE}/settings`, () => HttpResponse.json({ items: [repository] })));
}

function managedBy(kind: ManagerKind, { allowsEdits = false } = {}): ManagedResource {
  return {
    metadata: {
      annotations: {
        [AnnoKeyManagerKind]: kind,
        [AnnoKeyManagerIdentity]: 'my-repo',
        ...(allowsEdits ? { [AnnoKeyManagerAllowsEdits]: 'true' } : {}),
      },
    },
  };
}

const LOCK = 'icon-exchange-alt-lock';
const NO_LOCK = 'icon-exchange-alt';

describe('ManagedResourceBreadcrumbBadge', () => {
  let originalProvisioning: boolean;

  beforeEach(() => {
    originalProvisioning = config.provisioningEnabled;
    config.provisioningEnabled = true;
    mockRepository(['write']);
  });

  afterEach(() => {
    config.provisioningEnabled = originalProvisioning;
  });

  describe('a resource Grafana writes back through the repository', () => {
    it('is read-only when the repository has no write workflow', async () => {
      mockRepository([]);
      render(<ManagedResourceBreadcrumbBadge resource={managedBy(ManagerKind.Repo)} canEdit writesBackToRepository />);

      expect(await screen.findByTestId(LOCK)).toBeInTheDocument();
    });

    it('is editable when the repository accepts writes', async () => {
      render(<ManagedResourceBreadcrumbBadge resource={managedBy(ManagerKind.Repo)} canEdit writesBackToRepository />);

      expect(await screen.findByTestId(NO_LOCK)).toBeInTheDocument();
    });

    it('falls back to the manager annotation when provisioning is disabled', async () => {
      config.provisioningEnabled = false;
      render(<ManagedResourceBreadcrumbBadge resource={managedBy(ManagerKind.Repo)} canEdit writesBackToRepository />);

      expect(await screen.findByTestId(LOCK)).toBeInTheDocument();
    });

    it.each([
      ['disallows edits', { allowsEdits: false }, LOCK],
      ['allows edits', { allowsEdits: true }, NO_LOCK],
    ])('follows a non-repository manager that %s', async (_, options, expected) => {
      render(
        <ManagedResourceBreadcrumbBadge
          resource={managedBy(ManagerKind.Terraform, options)}
          canEdit
          writesBackToRepository
        />
      );

      expect(await screen.findByTestId(expected)).toBeInTheDocument();
    });
  });

  // Provisioning's own configuration: a repository that provisions itself is still only changeable
  // where it was provisioned from, so the repository's write workflow does not make it editable.
  it('ignores the repository workflow for a resource with no write-back flow', async () => {
    render(<ManagedResourceBreadcrumbBadge resource={managedBy(ManagerKind.Repo)} canEdit />);

    expect(await screen.findByTestId(LOCK)).toBeInTheDocument();
  });

  it('leaves the badge unlocked for a user who could not edit anyway', async () => {
    mockRepository([]);
    render(
      <ManagedResourceBreadcrumbBadge resource={managedBy(ManagerKind.Repo)} canEdit={false} writesBackToRepository />
    );

    expect(await screen.findByTestId(NO_LOCK)).toBeInTheDocument();
  });
});
