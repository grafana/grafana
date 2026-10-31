import { render, screen, within } from 'test/test-utils';

import { type Bundle, useGetBundleQuery } from 'app/api/clients/provisioning/v0alpha1';

import BundleViewPage from './BundleViewPage';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  ...jest.requireActual('app/api/clients/provisioning/v0alpha1'),
  useGetBundleQuery: jest.fn(),
}));

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useParams: () => ({ name: 'sample' }),
}));

const mockUseGetBundleQuery = jest.mocked(useGetBundleQuery);

const bundle: Bundle = {
  metadata: { name: 'sample' },
  spec: { paths: ['bundles/sample/README.md', 'bundles/sample/docs/'] },
  status: {
    ref: '9f2c1ab',
    files: [
      { path: 'bundles/sample/README.md', name: 'sample-7f3a9c21e4b8', hash: 'sha256:aaa', size: 2048 },
      { path: 'bundles/sample/docs/overview.md', name: 'sample-91c4ef02ab77', hash: 'sha256:bbb', size: 4096 },
    ],
  },
};

// The page reads `data`, `isLoading` and `isError`; the rest of the RTK query result is unused.
function setupQuery(result: Partial<ReturnType<typeof useGetBundleQuery>>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUseGetBundleQuery.mockReturnValue({ isLoading: false, isError: false, ...result } as any);
}

describe('BundleViewPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists the files the bundle resolved to, with their sizes', async () => {
    setupQuery({ data: bundle });

    render(<BundleViewPage />);

    // Scoped to the table: a declared path that is itself a file also appears above, under
    // "Declared paths", so an unscoped query matches twice.
    const files = within(await screen.findByRole('table'));
    expect(files.getByText('bundles/sample/README.md')).toBeInTheDocument();
    expect(files.getByText('bundles/sample/docs/overview.md')).toBeInTheDocument();
    expect(files.getByText('2.0 KB')).toBeInTheDocument();
    expect(files.getByText('4.0 KB')).toBeInTheDocument();
  });

  it('lists the declared paths, including folders that expanded', async () => {
    setupQuery({ data: bundle });

    render(<BundleViewPage />);

    // The folder entry is declared but is not itself a file, so it appears only here.
    expect(await screen.findByText('bundles/sample/docs/')).toBeInTheDocument();
  });

  it('shows the ref the files were resolved at', async () => {
    setupQuery({ data: bundle });

    render(<BundleViewPage />);

    expect(await screen.findByText('resolved at 9f2c1ab')).toBeInTheDocument();
  });

  it('warns when a declared path resolved to nothing', async () => {
    setupQuery({
      data: { ...bundle, status: { ...bundle.status, unresolved: ['bundles/sample/examples/'] } },
    });

    render(<BundleViewPage />);

    expect(await screen.findByText('Some declared paths matched no files')).toBeInTheDocument();
    expect(screen.getByText('bundles/sample/examples/')).toBeInTheDocument();
  });

  it('does not warn when every declared path resolved', async () => {
    setupQuery({ data: bundle });

    render(<BundleViewPage />);

    // Assert the loaded state first so the negative check isn't racing the render.
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByText('Some declared paths matched no files')).not.toBeInTheDocument();
  });

  it('explains that a bundle may not have synced yet when it is not found', async () => {
    setupQuery({ isError: true, error: { status: 404, data: {} } });

    render(<BundleViewPage />);

    expect(await screen.findByText('Bundle not found')).toBeInTheDocument();
  });
});
