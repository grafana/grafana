import { Fragment, type PropsWithChildren } from 'react';
import { render, screen } from 'test/test-utils';

import { isOnPrem } from '../utils/isOnPrem';

import { QuotaLimitMessage } from './QuotaLimitMessage';

jest.mock('../utils/isOnPrem', () => ({
  isOnPrem: jest.fn(() => false),
}));

const mockIsOnPrem = jest.mocked(isOnPrem);

const EmptyWrapper = ({ children }: PropsWithChildren) => <Fragment>{children}</Fragment>;

function renderMessage(props: Parameters<typeof QuotaLimitMessage>[0] = {}) {
  return render(<QuotaLimitMessage {...props} />, { wrapper: EmptyWrapper });
}

describe('QuotaLimitMessage', () => {
  beforeEach(() => {
    mockIsOnPrem.mockReturnValue(false);
  });

  describe('rendering nothing', () => {
    it('should return null when no limits are set', () => {
      const { container } = renderMessage();
      expect(container).toBeEmptyDOMElement();
    });

    it('should return null when both limits are zero', () => {
      const { container } = renderMessage({ maxRepositories: 0, maxResourcesPerRepository: 0 });
      expect(container).toBeEmptyDOMElement();
    });

    it('should return null when limits are negative', () => {
      const { container } = renderMessage({ maxRepositories: -1, maxResourcesPerRepository: -5 });
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('repository limit only (cloud)', () => {
    it('should show cloud repository limit message', () => {
      const { container } = renderMessage({ maxRepositories: 3 });
      expect(container.textContent).toContain('Your account is limited to 3 connected repositories.');
    });

    it('should show action link with transition by default', () => {
      const { container } = renderMessage({ maxRepositories: 3 });
      expect(container.textContent).toContain('To add more repositories,');
      expect(screen.getByRole('link', { name: /upgrade your account/ })).toBeInTheDocument();
    });

    it('should link to the upgrade URL', () => {
      renderMessage({ maxRepositories: 3 });
      expect(screen.getByRole('link', { name: /upgrade your account/ })).toHaveAttribute(
        'href',
        'https://grafana.com/profile/org/subscription'
      );
    });
  });

  describe('repository limit only (on-prem)', () => {
    beforeEach(() => {
      mockIsOnPrem.mockReturnValue(true);
    });

    it('should show on-prem repository limit message', () => {
      const { container } = renderMessage({ maxRepositories: 3 });
      expect(container.textContent).toContain('Your instance is limited to 3 connected repositories.');
    });

    it('should show configuration link', () => {
      renderMessage({ maxRepositories: 3 });
      expect(screen.getByRole('link', { name: /update your Grafana configuration/ })).toBeInTheDocument();
    });

    it('should link to the configuration docs URL', () => {
      renderMessage({ maxRepositories: 3 });
      expect(screen.getByRole('link', { name: /update your Grafana configuration/ })).toHaveAttribute(
        'href',
        'https://grafana.com/docs/grafana/latest/setup-grafana/configure-grafana/#provisioning'
      );
    });
  });

  describe('resource limit only (cloud)', () => {
    it('should show cloud resource limit message', () => {
      const { container } = renderMessage({ maxResourcesPerRepository: 100 });
      expect(container.textContent).toContain('Your account is limited to 100 synced resources per repository.');
    });
  });

  describe('resource limit only (on-prem)', () => {
    beforeEach(() => {
      mockIsOnPrem.mockReturnValue(true);
    });

    it('should show on-prem resource limit message', () => {
      const { container } = renderMessage({ maxResourcesPerRepository: 100 });
      expect(container.textContent).toContain('Your instance is limited to 100 synced resources per repository.');
    });
  });

  describe('both limits (cloud)', () => {
    it('should show both repository and resource limits', () => {
      const { container } = renderMessage({ maxRepositories: 3, maxResourcesPerRepository: 100 });
      expect(container.textContent).toContain('Your account is limited to 3 connected repositories');
      expect(container.textContent).toContain('and 100 synced resources per repository.');
    });

    it('should use "limits" as the transition type', () => {
      const { container } = renderMessage({ maxRepositories: 3, maxResourcesPerRepository: 100 });
      expect(container.textContent).toContain('To add more limits,');
    });
  });

  describe('both limits (on-prem)', () => {
    beforeEach(() => {
      mockIsOnPrem.mockReturnValue(true);
    });

    it('should show both on-prem limits', () => {
      const { container } = renderMessage({ maxRepositories: 3, maxResourcesPerRepository: 100 });
      expect(container.textContent).toContain('Your instance is limited to 3 connected repositories');
      expect(container.textContent).toContain('and 100 synced resources per repository.');
    });

    it('should use "limits" as the transition type', () => {
      const { container } = renderMessage({ maxRepositories: 3, maxResourcesPerRepository: 100 });
      expect(container.textContent).toContain('To add more limits,');
    });
  });

  describe('showActionLink prop', () => {
    it('should hide the action link when showActionLink is false', () => {
      const { container } = renderMessage({ maxRepositories: 3, showActionLink: false });
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(container.textContent).not.toContain('To add more');
    });

    it('should show the action link when showActionLink is true (default)', () => {
      renderMessage({ maxRepositories: 3 });
      expect(screen.getByRole('link')).toBeInTheDocument();
    });
  });
});
