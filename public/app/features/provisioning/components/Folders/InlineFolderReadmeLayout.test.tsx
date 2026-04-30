import { render, screen } from '@testing-library/react';

import { config } from '@grafana/runtime';

import { InlineFolderReadmeLayout } from './InlineFolderReadmeLayout';

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    config: {
      ...actual.config,
      featureToggles: {},
    },
  };
});

// Mock FolderReadmePanel so we can verify it renders without pulling in
// its full dependency tree (RTK Query hooks, markdown, etc.).
let mockPanelStatus = 'ok';
jest.mock('./FolderReadmePanel', () => ({
  FolderReadmePanel: ({ folderUID }: { folderUID: string }) => (
    <div data-testid="readme-panel" data-status={mockPanelStatus}>
      {folderUID}
    </div>
  ),
}));

function renderLayout(overrides: Partial<React.ComponentProps<typeof InlineFolderReadmeLayout>> = {}) {
  return render(
    <InlineFolderReadmeLayout folderUID="test-folder" isProvisionedFolder={true} className="subView" {...overrides}>
      <span>child</span>
    </InlineFolderReadmeLayout>
  );
}

describe('InlineFolderReadmeLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.featureToggles = { provisioningReadmes: true };
    mockPanelStatus = 'ok';
  });

  describe('when feature is disabled', () => {
    it('renders only the plain wrapper when toggle is off', () => {
      config.featureToggles = { provisioningReadmes: false };

      const { container } = renderLayout();
      const wrapper = container.querySelector('.subView');

      expect(wrapper).toBeInTheDocument();
      expect(wrapper!.getAttribute('style')).toBeNull();
      expect(screen.getByText('child')).toBeInTheDocument();
      expect(screen.queryByTestId('readme-panel')).not.toBeInTheDocument();
    });

    it('renders only the plain wrapper when toggle is undefined', () => {
      config.featureToggles = {};

      const { container } = renderLayout();
      const wrapper = container.querySelector('.subView');

      expect(wrapper).toBeInTheDocument();
      expect(wrapper!.getAttribute('style')).toBeNull();
      expect(screen.queryByTestId('readme-panel')).not.toBeInTheDocument();
    });
  });

  describe('when folder is not provisioned', () => {
    it('renders only the plain wrapper with no inline style', () => {
      const { container } = renderLayout({ isProvisionedFolder: false });
      const wrapper = container.querySelector('.subView');

      expect(wrapper).toBeInTheDocument();
      expect(wrapper!.getAttribute('style')).toBeNull();
      expect(screen.getByText('child')).toBeInTheDocument();
      expect(screen.queryByTestId('readme-panel')).not.toBeInTheDocument();
    });
  });

  describe('when folderUID is undefined', () => {
    it('renders only the plain wrapper with no inline style', () => {
      const { container } = renderLayout({ folderUID: undefined });
      const wrapper = container.querySelector('.subView');

      expect(wrapper).toBeInTheDocument();
      expect(wrapper!.getAttribute('style')).toBeNull();
      expect(screen.getByText('child')).toBeInTheDocument();
      expect(screen.queryByTestId('readme-panel')).not.toBeInTheDocument();
    });
  });

  describe('when enabled', () => {
    it('renders the wrapper WITHOUT inline style and appends the readme panel', () => {
      const { container } = renderLayout();
      const wrapper = container.querySelector('.subView');

      expect(wrapper).toBeInTheDocument();
      expect(wrapper!.getAttribute('style')).toBeNull();
      expect(screen.getByText('child')).toBeInTheDocument();
      expect(screen.getByTestId('readme-panel')).toBeInTheDocument();
      expect(screen.getByTestId('readme-panel')).toHaveTextContent('test-folder');
    });

    it('does not apply inline style to the wrapper when feature is on', () => {
      const { container } = renderLayout();
      const wrapper = container.querySelector('.subView');

      expect(wrapper!.getAttribute('style')).toBeNull();
    });
  });

  describe('render isolation', () => {
    // The wrapper div's outerHTML must be identical regardless of what the
    // FolderReadmePanel renders — proving that the dashboards list's DOM
    // does not depend on the README panel's data/status in any way.
    it('wrapper div is structurally identical across all panel status values', () => {
      const wrapperHTMLs: string[] = [];

      for (const status of ['loading', 'ok', 'missing', 'error']) {
        mockPanelStatus = status;
        const { container, unmount } = renderLayout();
        const wrapper = container.querySelector('.subView');
        expect(wrapper).toBeInTheDocument();
        wrapperHTMLs.push(wrapper!.outerHTML);
        unmount();
      }

      // All four renders must produce byte-identical wrapper divs
      const [first, ...rest] = wrapperHTMLs;
      for (const html of rest) {
        expect(html).toBe(first);
      }
    });
  });
});
