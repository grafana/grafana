import { render, screen } from '@testing-library/react';

import { type DataQueryError } from '@grafana/data';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { ErrorContainer, type ErrorContainerProps } from '../ErrorContainer';
import { NoData } from '../NoData';
import { NoDataSourceCallToAction } from '../NoDataSourceCallToAction';

jest.mock('app/core/services/context_srv');

const mockedContextSrv = jest.mocked(contextSrv);

describe('Explore Components i18n Verification', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ErrorContainer', () => {
    it('handles queryError === undefined: renders hidden Alert with "Unknown error" title and null message', () => {
      const props: ErrorContainerProps = { queryError: undefined };
      render(<ErrorContainer {...props} />);

      const alertEl = screen.getByRole('alert', { hidden: true });
      expect(alertEl).toBeInTheDocument();
      expect(alertEl).toHaveTextContent('Unknown error');
      // No extra message should be rendered
      expect(alertEl.textContent).toBe('Unknown error');
    });

    it('handles empty props object: renders hidden Alert with "Unknown error" title', () => {
      render(<ErrorContainer />);

      const alertEl = screen.getByRole('alert', { hidden: true });
      expect(alertEl).toBeInTheDocument();
      expect(alertEl).toHaveTextContent('Unknown error');
    });

    it('handles queryError where queryError.data lacks message property', () => {
      const props: ErrorContainerProps = {
        queryError: {
          data: {
            error: 'Fatal database crash',
            extraInfo: 12345,
          },
          refId: 'A',
        } as unknown as DataQueryError,
      };
      render(<ErrorContainer {...props} />);

      const alertEl = screen.getByRole('alert');
      expect(alertEl).toBeInTheDocument();
      expect(alertEl).toHaveTextContent(/query error/i);
      // alert text should only be "Query error" since neither message nor data.message exist
      expect(alertEl.textContent).toBe('Query error');
    });

    it('handles queryError where data is a non-object primitive (string, number, null)', () => {
      const primitives = ['Plain error string', 500, null, true];

      for (const prim of primitives) {
        const { unmount } = render(
          <ErrorContainer
            queryError={
              {
                data: prim,
                refId: 'B',
              } as unknown as DataQueryError
            }
          />
        );

        const alertEl = screen.getByRole('alert');
        expect(alertEl).toBeInTheDocument();
        expect(alertEl).toHaveTextContent(/query error/i);
        expect(alertEl.textContent).toBe('Query error');
        unmount();
      }
    });

    it('respects precedence: queryError.message takes priority over queryError.data.message', () => {
      const props: ErrorContainerProps = {
        queryError: {
          message: 'Top-level explicit message',
          data: {
            message: 'Nested data payload message',
          },
          refId: 'A',
        },
      };
      render(<ErrorContainer {...props} />);

      const alertEl = screen.getByRole('alert');
      expect(alertEl).toBeInTheDocument();
      expect(alertEl).toHaveTextContent('Top-level explicit message');
      expect(alertEl).not.toHaveTextContent('Nested data payload message');
    });

    it('falls back to data.message when queryError.message is empty string (short-circuit test)', () => {
      const props: ErrorContainerProps = {
        queryError: {
          message: '',
          data: {
            message: 'Fallback from empty top message',
          },
          refId: 'A',
        },
      };
      render(<ErrorContainer {...props} />);

      const alertEl = screen.getByRole('alert');
      expect(alertEl).toBeInTheDocument();
      expect(alertEl).toHaveTextContent('Fallback from empty top message');
    });

    it('handles complex string inputs: Unicode, emojis, special characters, and long payloads', () => {
      // 1. Unicode & Emojis
      const unicodeStr = '⚠️ Error: 数据库连接失败 🚨 (Unicode + Emojis)';
      const { unmount: unmount1 } = render(<ErrorContainer queryError={{ message: unicodeStr, refId: 'STRESS1' }} />);
      expect(screen.getByRole('alert')).toHaveTextContent(unicodeStr);
      unmount1();

      // 2. HTML escaping verification (script injection)
      const xssStr = '<script data-testid="injected-script">alert("XSS")</script>&<>"\'';
      const { unmount: unmount2 } = render(<ErrorContainer queryError={{ message: xssStr, refId: 'STRESS2' }} />);
      expect(screen.queryByTestId('injected-script')).toBeNull();
      expect(screen.getByRole('alert')).toHaveTextContent(xssStr);
      unmount2();

      // 3. Multiline and whitespace
      const multilineStr = 'Line 1\nLine 2\tTabbed\r\nLine 3';
      const { unmount: unmount3 } = render(<ErrorContainer queryError={{ message: multilineStr, refId: 'STRESS3' }} />);
      expect(screen.getByRole('alert')).toHaveTextContent(/Line 1\s+Line 2\s+Tabbed\s+Line 3/);
      unmount3();

      // 4. Large payload
      const longStr = 'A'.repeat(5000);
      const { unmount: unmount4 } = render(<ErrorContainer queryError={{ message: longStr, refId: 'STRESS4' }} />);
      expect(screen.getByRole('alert')).toHaveTextContent(longStr);
      unmount4();
    });
  });

  // ==========================================================================
  // 2. NoData RTL Rendering, DOM Structure & CSS Attachment Tests
  // ==========================================================================
  describe('NoData', () => {
    it('renders cleanly in RTL and mounts expected testid and text', () => {
      render(<NoData />);

      const containerEl = screen.getByTestId('explore-no-data');
      expect(containerEl).toBeInTheDocument();
      expect(containerEl).toHaveTextContent('No data');
      expect(screen.getByText('No data')).toBeInTheDocument();
    });

    it('verifies DOM rendering of message within container', () => {
      render(<NoData />);

      const containerEl = screen.getByTestId('explore-no-data');
      expect(containerEl).toBeInTheDocument();
      expect(containerEl).toHaveTextContent('No data');
    });

    it('attaches styles to container and message elements', () => {
      render(<NoData />);

      const containerEl = screen.getByTestId('explore-no-data');
      const textEl = screen.getByText('No data');

      expect(containerEl.className).toBeTruthy();
      expect(textEl.className).toBeTruthy();
    });

    it('is idempotent and robust under repeated re-rendering', () => {
      const { rerender } = render(<NoData />);
      expect(screen.getByText('No data')).toBeInTheDocument();

      rerender(<NoData />);
      expect(screen.getByText('No data')).toBeInTheDocument();

      rerender(<NoData />);
      expect(screen.getByText('No data')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // 3. NoDataSourceCallToAction CTA Message & Permissions Matrix Tests
  // ==========================================================================
  describe('NoDataSourceCallToAction CTA Message & Permissions Matrix', () => {
    const expectedCtaMessage =
      'Explore requires at least one data source. Once you have added a data source, you can query it here.';

    it('renders the localized CTA message text correctly in CallToActionCard', () => {
      mockedContextSrv.hasPermission.mockReturnValue(true);
      render(<NoDataSourceCallToAction />);

      expect(screen.getByText(expectedCtaMessage)).toBeInTheDocument();
    });

    it('renders the footer content: ProTip, documentation link, and rocket icon', () => {
      mockedContextSrv.hasPermission.mockReturnValue(true);
      render(<NoDataSourceCallToAction />);

      expect(
        screen.getByText(/ProTip: You can also define data sources through configuration files/i)
      ).toBeInTheDocument();

      const learnMoreLink = screen.getByRole('link', { name: /learn more/i });
      expect(learnMoreLink).toBeInTheDocument();
      expect(learnMoreLink).toHaveAttribute(
        'href',
        'http://docs.grafana.org/administration/provisioning/?utm_source=explore#data-sources'
      );
      expect(learnMoreLink).toHaveAttribute('target', '_blank');
      expect(learnMoreLink).toHaveAttribute('rel', 'noreferrer');
    });

    it('enables "Add data source" button when user has BOTH DataSourcesCreate AND DataSourcesWrite permissions', () => {
      mockedContextSrv.hasPermission.mockImplementation((action) => {
        return action === AccessControlAction.DataSourcesCreate || action === AccessControlAction.DataSourcesWrite;
      });

      render(<NoDataSourceCallToAction />);

      const addBtn = screen.getByRole('link', { name: /add data source/i });
      expect(addBtn).toBeInTheDocument();
      expect(addBtn).toHaveAttribute('href', 'datasources/new');
      expect(addBtn).not.toHaveAttribute('aria-disabled', 'true');
      expect(addBtn).not.toHaveClass('disabled');
    });

    it('disables "Add data source" button when DataSourcesCreate is false', () => {
      mockedContextSrv.hasPermission.mockImplementation((action) => {
        if (action === AccessControlAction.DataSourcesCreate) {
          return false;
        }
        if (action === AccessControlAction.DataSourcesWrite) {
          return true;
        }
        return false;
      });

      render(<NoDataSourceCallToAction />);

      const addBtn = screen.getByRole('link', { name: /add data source/i });
      expect(addBtn).toBeInTheDocument();
      expect(addBtn.getAttribute('aria-disabled') === 'true' || addBtn.hasAttribute('disabled')).toBe(true);
    });

    it('disables "Add data source" button when DataSourcesWrite is false', () => {
      mockedContextSrv.hasPermission.mockImplementation((action) => {
        if (action === AccessControlAction.DataSourcesCreate) {
          return true;
        }
        if (action === AccessControlAction.DataSourcesWrite) {
          return false;
        }
        return false;
      });

      render(<NoDataSourceCallToAction />);

      const addBtn = screen.getByRole('link', { name: /add data source/i });
      expect(addBtn).toBeInTheDocument();
      expect(addBtn.getAttribute('aria-disabled') === 'true' || addBtn.hasAttribute('disabled')).toBe(true);
    });

    it('disables "Add data source" button when BOTH permissions are false', () => {
      mockedContextSrv.hasPermission.mockReturnValue(false);

      render(<NoDataSourceCallToAction />);

      const addBtn = screen.getByRole('link', { name: /add data source/i });
      expect(addBtn).toBeInTheDocument();
      expect(addBtn.getAttribute('aria-disabled') === 'true' || addBtn.hasAttribute('disabled')).toBe(true);
    });
  });
});
