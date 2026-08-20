import { render, screen } from '@testing-library/react';

import { textUtil } from '@grafana/data';

import { BranchDisplay } from './BranchDisplay';

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  textUtil: {
    sanitizeUrl: jest.fn(),
  },
}));

const mockTextUtil = jest.mocked(textUtil);

describe('BranchDisplay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTextUtil.sanitizeUrl.mockImplementation((url) => url);
  });

  it('renders the branch name', () => {
    render(<BranchDisplay baseUrl="https://github.com/org/repo" branch="feature/foo" repoType="github" />);

    expect(screen.getByText('feature/foo')).toBeInTheDocument();
  });

  it('renders as a link opening the branch in a new tab for GitHub repos', () => {
    render(<BranchDisplay baseUrl="https://github.com/org/repo" branch="feature/foo" repoType="github" />);

    const link = screen.getByRole('link', { name: /feature\/foo/ });
    expect(link).toHaveAttribute('href', 'https://github.com/org/repo/tree/feature/foo');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('builds the correct branch URL for GitLab repos', () => {
    render(<BranchDisplay baseUrl="https://gitlab.com/org/repo" branch="develop" repoType="gitlab" />);

    expect(screen.getByRole('link', { name: /develop/ })).toHaveAttribute(
      'href',
      'https://gitlab.com/org/repo/-/tree/develop'
    );
  });

  it('builds the correct branch URL for Bitbucket repos', () => {
    render(<BranchDisplay baseUrl="https://bitbucket.org/org/repo" branch="main" repoType="bitbucket" />);

    expect(screen.getByRole('link', { name: /main/ })).toHaveAttribute(
      'href',
      'https://bitbucket.org/org/repo/src/main'
    );
  });

  it('sanitizes the branch URL before using it as href', () => {
    mockTextUtil.sanitizeUrl.mockReturnValue('safe-url');

    render(<BranchDisplay baseUrl="https://github.com/org/repo" branch="feature/foo" repoType="github" />);

    expect(mockTextUtil.sanitizeUrl).toHaveBeenCalledWith('https://github.com/org/repo/tree/feature/foo');
    expect(screen.getByRole('link', { name: /feature\/foo/ })).toHaveAttribute('href', 'safe-url');
  });

  it('renders as plain text (no link) for local repos', () => {
    render(<BranchDisplay baseUrl="https://github.com/org/repo" branch="feature/foo" repoType="local" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('feature/foo')).toBeInTheDocument();
  });

  it('renders as plain text (no link) for unknown repo types', () => {
    render(<BranchDisplay baseUrl="https://github.com/org/repo" branch="feature/foo" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('feature/foo')).toBeInTheDocument();
  });
});
