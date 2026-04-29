import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom-v5-compat';

import { config, reportInteraction } from '@grafana/runtime';

import { useFolderReadme } from '../../hooks/useFolderReadme';

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

const mockUseFolderReadme = useFolderReadme as jest.MockedFunction<typeof useFolderReadme>;
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

function setReadmeResult(overrides: Partial<ReturnType<typeof useFolderReadme>> = {}) {
  mockUseFolderReadme.mockReturnValue({
    repository: mockRepository,
    folder: undefined,
    readmePath: 'README.md',
    isRepoLoading: false,
    isFileLoading: false,
    isError: false,
    fileData: { resource: { file: { content: '# hello' } } } as never,
    ...overrides,
  });
}

describe('FolderReadmeHint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.featureToggles = { provisioningReadmes: true };
  });

  it('renders an inline link that scrolls to the README panel anchor when the list is long', () => {
    setReadmeResult();

    renderWithRouter(<FolderReadmeHint folderUID="test-folder" itemCount={FOLDER_README_HINT_MIN_ITEMS} />);

    expect(screen.getByText(/Lots of dashboards/i)).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /See the README/i });
    expect(link.getAttribute('href')).toMatch(/#folder-readme$/);
  });

  it('reports an interaction when the link is clicked', () => {
    setReadmeResult();

    renderWithRouter(<FolderReadmeHint folderUID="test-folder" itemCount={FOLDER_README_HINT_MIN_ITEMS} />);
    fireEvent.click(screen.getByRole('link', { name: /See the README/i }));

    expect(mockReportInteraction).toHaveBeenCalledWith('grafana_provisioning_readme_hint_clicked', {
      repositoryType: 'github',
    });
  });

  it('renders nothing when the dashboards list is below the threshold', () => {
    setReadmeResult();

    const { container } = renderWithRouter(
      <FolderReadmeHint folderUID="test-folder" itemCount={FOLDER_README_HINT_MIN_ITEMS - 1} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the feature toggle is off', () => {
    config.featureToggles = { provisioningReadmes: false };
    setReadmeResult();

    const { container } = renderWithRouter(<FolderReadmeHint folderUID="test-folder" itemCount={50} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while still loading', () => {
    setReadmeResult({ isFileLoading: true });

    const { container } = renderWithRouter(<FolderReadmeHint folderUID="test-folder" itemCount={50} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the README fetch fails', () => {
    setReadmeResult({ isError: true, fileData: undefined });

    const { container } = renderWithRouter(<FolderReadmeHint folderUID="test-folder" itemCount={50} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when no README is found', () => {
    setReadmeResult({ fileData: undefined });

    const { container } = renderWithRouter(<FolderReadmeHint folderUID="test-folder" itemCount={50} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the folder is not provisioned', () => {
    setReadmeResult({ repository: undefined });

    const { container } = renderWithRouter(<FolderReadmeHint folderUID="test-folder" itemCount={50} />);
    expect(container).toBeEmptyDOMElement();
  });
});
