import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { textUtil } from '@grafana/data';

import { PreviewBannerViewPR } from './PreviewBannerViewPR';

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  textUtil: {
    sanitizeUrl: jest.fn(),
  },
}));

jest.mock('@grafana/i18n', () => ({
  t: jest.fn((key: string, defaultValue: string) => defaultValue),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

const mockTextUtil = jest.mocked(textUtil);

function setup(props: { prParam: string; isFolder?: boolean; isNewPr?: boolean } = { prParam: 'test-url' }) {
  const defaultProps = {
    isFolder: false,
    isNewPr: false,
    ...props,
  };

  const renderResult = render(<PreviewBannerViewPR {...defaultProps} />);

  return { renderResult, props: defaultProps };
}

describe('PreviewBannerViewPR', () => {
  let windowOpenSpy: jest.SpyInstance;

  beforeAll(() => {
    Object.defineProperty(window, 'open', {
      writable: true,
      value: jest.fn(),
    });
    windowOpenSpy = jest.spyOn(window, 'open');
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockTextUtil.sanitizeUrl.mockImplementation((url) => url);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    windowOpenSpy.mockRestore();
  });

  describe('Dashboard scenarios', () => {
    it('should render correct text for new PR dashboard', () => {
      setup({ prParam: 'test-url', isFolder: false, isNewPr: true });

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('A new resource has been created in a branch in GitHub.')).toBeInTheDocument();
    });

    it('should render correct text for existing PR dashboard', () => {
      setup({ prParam: 'test-url', isFolder: false, isNewPr: false });

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('This resource is loaded from a pull request in GitHub.')).toBeInTheDocument();
    });

    it('should render correct button text for new PR dashboard', () => {
      setup({ prParam: 'test-url', isFolder: false, isNewPr: true });

      expect(screen.getByText('Open pull request in GitHub')).toBeInTheDocument();
    });

    it('should render correct button text for existing PR dashboard', () => {
      setup({ prParam: 'test-url', isFolder: false, isNewPr: false });

      expect(screen.getByText('View pull request in GitHub')).toBeInTheDocument();
    });
  });

  describe('Folder scenarios', () => {
    it('should render correct text for new PR folder', () => {
      setup({ prParam: 'test-url', isFolder: true, isNewPr: true });

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('A new resource has been created in a branch in GitHub.')).toBeInTheDocument();
    });

    it('should render correct text for existing PR folder', () => {
      setup({ prParam: 'test-url', isFolder: true, isNewPr: false });

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('This resource is loaded from a pull request in GitHub.')).toBeInTheDocument();
    });

    it('should render correct button text for new PR folder', () => {
      setup({ prParam: 'test-url', isFolder: true, isNewPr: true });

      expect(screen.getByText('Open pull request in GitHub')).toBeInTheDocument();
    });

    it('should render correct button text for existing PR folder', () => {
      setup({ prParam: 'test-url', isFolder: true, isNewPr: false });

      expect(screen.getByText('View pull request in GitHub')).toBeInTheDocument();
    });
  });

  describe('Button functionality', () => {
    it('should open URL in new tab when button is clicked', async () => {
      const testUrl = 'https://github.com/test/repo/pull/123';
      setup({ prParam: testUrl });

      const button = screen.getByRole('button', { name: /close alert/i });
      await userEvent.click(button);

      expect(windowOpenSpy).toHaveBeenCalledWith(testUrl, '_blank');
    });
  });
});
