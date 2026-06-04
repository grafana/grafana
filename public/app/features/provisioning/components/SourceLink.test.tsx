import { render, screen } from '@testing-library/react';

import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { SourceLink } from './SourceLink';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: { featureToggles: { provisioning: true } },
}));

const mockUseGetResourceRepositoryView = jest.fn();
jest.mock('../hooks/useGetResourceRepositoryView', () => ({
  useGetResourceRepositoryView: () => mockUseGetResourceRepositoryView(),
}));

function mockRepository(repository?: Partial<RepositoryView>) {
  mockUseGetResourceRepositoryView.mockReturnValue({ repository });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRepository(undefined);
});

describe('SourceLink', () => {
  it('renders a link to the source file in a GitHub repository', () => {
    mockRepository({
      name: 'my-repo',
      type: 'github',
      url: 'https://github.com/grafana/repo',
      branch: 'main',
    });

    render(<SourceLink repositoryName="my-repo" sourcePath="playlists/foo.json" />);

    const link = screen.getByRole('link', { name: /source \(github\)/i });
    expect(link).toHaveAttribute('href', 'https://github.com/grafana/repo/blob/main/playlists/foo.json');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('prefixes the repository path when present', () => {
    mockRepository({
      name: 'my-repo',
      type: 'github',
      url: 'https://github.com/grafana/repo',
      branch: 'main',
      path: 'grafana',
    });

    render(<SourceLink repositoryName="my-repo" sourcePath="playlists/foo.json" />);

    expect(screen.getByRole('link', { name: /source \(github\)/i })).toHaveAttribute(
      'href',
      'https://github.com/grafana/repo/blob/main/grafana/playlists/foo.json'
    );
  });

  it('renders nothing without a source path', () => {
    mockRepository({ name: 'my-repo', type: 'github', url: 'https://github.com/grafana/repo' });
    const { container } = render(<SourceLink repositoryName="my-repo" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the repository cannot be resolved', () => {
    mockRepository(undefined);
    const { container } = render(<SourceLink repositoryName="my-repo" sourcePath="playlists/foo.json" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for non-git providers (local)', () => {
    mockRepository({ name: 'my-repo', type: 'local' });
    const { container } = render(<SourceLink repositoryName="my-repo" sourcePath="playlists/foo.json" />);
    expect(container).toBeEmptyDOMElement();
  });
});
