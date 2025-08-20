import { render } from 'test/test-utils';

import { locationUtil, type GrafanaConfig } from '@grafana/data';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { SignInLink } from './SignInLink';

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    ...jest.requireActual('app/core/services/context_srv').contextSrv,
    setRedirectToUrl: jest.fn(),
  },
}));

describe('SignInLink', () => {
  it('should render a link to the login page', () => {
    const { getByText } = render(<SignInLink />);
    const link = getByText('Sign in');

    expect(link).toHaveAttribute('href', '/?forceLogin=true');
    expect(link).toHaveAttribute('target', '_self');
  });

  describe('with multiTenantFrontend toggle enabled', () => {
    beforeAll(() => {
      config.featureToggles.multiTenantFrontend = true;
    });

    it('should render a link to the login page', () => {
      const { getByText } = render(<SignInLink />);
      const link = getByText('Sign in');

      expect(link).toHaveAttribute('href', '/login');
      expect(link).not.toHaveAttribute('target', '_self');
    });

    it('remember the redirect url for after login', () => {
      const { getByText } = render(<SignInLink />);
      const link = getByText('Sign in');

      link.click();

      expect(contextSrv.setRedirectToUrl).toHaveBeenCalled();
    });

    it('renders the app base url when served from a subpath', () => {
      locationUtil.initialize({
        config: { appSubUrl: '/subpath' } as GrafanaConfig,
        getTimeRangeForUrl: () => ({ from: 'now-1d', to: 'now' }),
        getVariablesUrlParams: () => ({}),
      });

      const { getByText } = render(<SignInLink />);
      const link = getByText('Sign in');

      expect(link).toHaveAttribute('href', '/subpath/login');
    });
  });
});
