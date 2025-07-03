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
  let openSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // @ts-expect-error global.open should return a Window, but is not implemented in js-dom.
    openSpy = jest.spyOn(global, 'open').mockReturnValue(true);
    mockTextUtil.sanitizeUrl.mockImplementation((url) => url);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Dashboard scenarios', () => {
    it('should render correct text for new PR dashboard', () => {
      setup({ prParam: 'test-url', isFolder: false, isNewPr: true });

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('This dashboard is loaded from a branch in GitHub.')).toBeInTheDocument();
    });

    it('should render correct text for existing PR dashboard', () => {
      setup({ prParam: 'test-url', isFolder: false, isNewPr: false });

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('This dashboard is loaded from a pull request in GitHub.')).toBeInTheDocument();
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
      expect(screen.getByText('A new folder has been created in a branch in GitHub.')).toBeInTheDocument();
    });

    it('should render correct text for existing PR folder', () => {
      setup({ prParam: 'test-url', isFolder: true, isNewPr: false });

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('A new folder has been created in a pull request in GitHub.')).toBeInTheDocument();
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

      expect(openSpy).toHaveBeenCalledWith(testUrl, '_blank');
    });
  });
});
