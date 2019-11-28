import { LoginPage } from '@grafana/e2e/src/pages/login/LoginPage';

describe('Login', () => {
  it('should pass', () => {
    const loginPage = new LoginPage();
    loginPage.visit();
    loginPage.login('admin', 'admin');
  });
});
