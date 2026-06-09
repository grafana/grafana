import { render, screen } from 'test/test-utils';

import { type ProvisionedResourceDataResult, useProvisionedResourceData } from '../../hooks/useProvisionedResourceData';
import { setupProvisioningMswServer } from '../../mocks/server';
import { type ManagedResource } from '../../utils/managedResource';

import {
  SaveProvisionedResourceDrawer,
  type SaveProvisionedResourceDrawerProps,
} from './SaveProvisionedResourceDrawer';

setupProvisioningMswServer();

jest.mock('../../hooks/useProvisionedRequestHandler', () => ({
  useProvisionedRequestHandler: jest.fn(),
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

jest.mock('../../hooks/useProvisionedResourceData', () => ({
  useProvisionedResourceData: jest.fn(),
}));

jest.mock('react-router-dom-v5-compat', () => {
  const actual = jest.requireActual('react-router-dom-v5-compat');
  return {
    ...actual,
    useNavigate: () => jest.fn(),
  };
});

const mockResource: ManagedResource = {
  metadata: {
    annotations: {
      'grafana.app/managedBy': 'repo',
      'grafana.app/managerId': 'test-repo',
      'grafana.app/sourcePath': 'resources/thing.json',
    },
  },
};

const defaultHookData: ProvisionedResourceDataResult = {
  repository: {
    name: 'test-repo',
    target: 'instance' as const,
    title: 'Test Repository',
    type: 'git' as const,
    workflows: ['write', 'branch'],
  },
  initialValues: {
    repo: 'test-repo',
    path: 'resources/thing.json',
    ref: 'main',
    workflow: 'write' as const,
    comment: '',
    title: 'Test Thing',
  },
  isReadOnlyRepo: false,
  canPushToConfiguredBranch: true,
};

function setup(props: Partial<SaveProvisionedResourceDrawerProps> = {}) {
  (useProvisionedResourceData as jest.Mock).mockReturnValue(defaultHookData);

  const onDismiss = jest.fn();
  const defaultProps: SaveProvisionedResourceDrawerProps = {
    resource: mockResource,
    resourceType: 'resource',
    resourceName: 'thing-uid',
    title: 'Test Thing',
    drawerTitle: 'Save provisioned thing',
    body: { apiVersion: 'v1', kind: 'Thing', metadata: { name: 'thing-uid' }, spec: {} },
    onDismiss,
  };

  return {
    ...render(<SaveProvisionedResourceDrawer {...defaultProps} {...props} />),
    onDismiss,
  };
}

describe('SaveProvisionedResourceDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  // Submit behaviour lives in SaveProvisionedResourceForm.test; this only covers the drawer chrome.
  it('renders the drawer header and embeds the resource form', async () => {
    setup();

    expect(await screen.findByRole('heading', { name: /save provisioned thing/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('calls onDismiss when the drawer is closed', async () => {
    const { user, onDismiss } = setup();

    await user.click(await screen.findByRole('button', { name: /close/i }));

    expect(onDismiss).toHaveBeenCalled();
  });
});
