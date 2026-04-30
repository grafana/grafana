import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom-v5-compat';

import { config, reportInteraction } from '@grafana/runtime';

import { useBrowseFolderItemCount } from '../../../browse-dashboards/state/hooks';
import { type UseFolderReadmeResult, useFolderReadme } from '../../hooks/useFolderReadme';

import { FOLDER_README_HINT_MIN_ITEMS, FolderReadmeHint } from './FolderReadmeHint';

function renderWithRouter(ui: ReactElement) {
  return render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{ui}</MemoryRouter>);
}

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    reportInteraction: jest.fn(),
    config: {
      ...actual.config,
      featureToggles: {},
    },
  };
});

jest.mock('../../hooks/useFolderReadme');
jest.mock('../../../browse-dashboards/state/hooks', () => ({
  ...jest.requireActual('../../../browse-dashboards/state/hooks'),
  useBrowseFolderItemCount: jest.fn(),
}));

const mockUseFolderReadme = useFolderReadme as jest.MockedFunction<typeof useFolderReadme>;
const mockUseBrowseFolderItemCount = useBrowseFolderItemCount as jest.MockedFunction<typeof useBrowseFolderItemCount>;
const mockReportInteraction = reportInteraction as jest.MockedFunction<typeof reportInteraction>;

const mockRepository = {
  name: 'test-repo',
  target: 'folder' as const,
  title: 'Test Repository',
  type: 'github' as const,
  url: 'https://github.com/owner/repo',
  branch: 'main',
  workflows: [],
};

function setReadmeResult(overrides: Partial<UseFolderReadmeResult> = {}) {
  mockUseFolderReadme.mockReturnValue({
    repository: mockRepository,
    folder: undefined,
    readmePath: 'README.md',
    status: 'ok',
    fileData: { resource: { file: { content: '# hello' } } } as never,
    refetch: jest.fn(),
    ...overrides,
  });
  mockUseBrowseFolderItemCount.mockReturnValue(FOLDER_README_HINT_MIN_ITEMS);
}

function setItemCount(n: number) {
  mockUseBrowseFolderItemCount.mockReturnValue(n);
}

describe('FolderReadmeHint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.featureToggles = { provisioningReadmes: true };
  });

  it('renders an inline link that scrolls to the README panel anchor when the list is long', () => {
    setReadmeResult();

    renderWithRouter(<FolderReadmeHint folderUID="test-folder" isProvisionedFolder={true} />);

    expect(screen.getByText(/Lots of dashboards/i)).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /See the README/i });
    expect(link.getAttribute('href')).toMatch(/#folder-readme$/);
  });

  it('reports an interaction when the link is clicked', () => {
    setReadmeResult();

    renderWithRouter(<FolderReadmeHint folderUID="test-folder" isProvisionedFolder={true} />);
    fireEvent.click(screen.getByRole('link', { name: /See the README/i }));

    expect(mockReportInteraction).toHaveBeenCalledWith('grafana_provisioning_readme_hint_clicked', {
      repositoryType: 'github',
    });
  });

  it('scrolls the README panel into view when the link is clicked', () => {
    setReadmeResult();

    // Stand-in for the panel anchor in the document so the hint can find it.
    const anchor = document.createElement('section');
    anchor.id = 'folder-readme';
    const scrollIntoView = jest.fn();
    anchor.scrollIntoView = scrollIntoView;
    document.body.appendChild(anchor);

    try {
      renderWithRouter(<FolderReadmeHint folderUID="test-folder" isProvisionedFolder={true} />);
      fireEvent.click(screen.getByRole('link', { name: /See the README/i }));

      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    } finally {
      anchor.remove();
    }
  });

  it('renders nothing when the dashboards list is below the threshold', () => {
    setReadmeResult();
    setItemCount(FOLDER_README_HINT_MIN_ITEMS - 1);

    const { container } = renderWithRouter(<FolderReadmeHint folderUID="test-folder" isProvisionedFolder={true} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when isProvisionedFolder is false', () => {
    setReadmeResult();

    const { container } = renderWithRouter(<FolderReadmeHint folderUID="test-folder" isProvisionedFolder={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when folderUID is undefined', () => {
    setReadmeResult();

    const { container } = renderWithRouter(<FolderReadmeHint folderUID={undefined} isProvisionedFolder={true} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the feature toggle is off', () => {
    config.featureToggles = { provisioningReadmes: false };
    setReadmeResult();

    const { container } = renderWithRouter(<FolderReadmeHint folderUID="test-folder" isProvisionedFolder={true} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while still loading', () => {
    setReadmeResult({ status: 'loading' });

    const { container } = renderWithRouter(<FolderReadmeHint folderUID="test-folder" isProvisionedFolder={true} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the README fetch fails', () => {
    setReadmeResult({ status: 'error', fileData: undefined });

    const { container } = renderWithRouter(<FolderReadmeHint folderUID="test-folder" isProvisionedFolder={true} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when no README is found', () => {
    setReadmeResult({ status: 'missing', fileData: undefined });

    const { container } = renderWithRouter(<FolderReadmeHint folderUID="test-folder" isProvisionedFolder={true} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the folder is not provisioned (repository undefined)', () => {
    setReadmeResult({ repository: undefined, status: 'loading' });

    const { container } = renderWithRouter(<FolderReadmeHint folderUID="test-folder" isProvisionedFolder={true} />);
    expect(container).toBeEmptyDOMElement();
  });
});
