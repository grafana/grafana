import { LoginPage } from '../../src/pages/login/LoginPage';

context('Login', () => {
  it('should pass', () => {
    const loginPage = new LoginPage();
    loginPage.visit();
    loginPage.login('admin', 'admin');
  });
});
