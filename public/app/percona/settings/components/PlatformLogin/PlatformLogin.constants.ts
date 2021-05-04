export const TERMS_OF_SERVICE_URL = 'https://per.co.na/pmm/platform-terms';

export const PRIVACY_POLICY_URL = 'https://per.co.na/pmm/platform-privacy';

export const RESET_PASSWORD_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://okta.percona.com/signin/forgot-password'
    : 'https://okta-dev.percona.com/signin/forgot-password';
