import { LoginCtrl } from './LoginCtrl';

describe('LoginCtrl', () => {
  describe('Login and signup', () => {
    let loginCtrl: LoginCtrl;
    beforeEach(() => {
      loginCtrl = new LoginCtrl({} as any);
    });
    it('call login with loginMode true', () => {
      loginCtrl.login = jest.fn();
      loginCtrl.submit(true);
      expect(loginCtrl.login).toBeCalled();
    });
    it('call signiup with loginMode false', () => {
      loginCtrl.signUp = jest.fn();
      loginCtrl.submit(false);
      expect(loginCtrl.signUp).toBeCalled();
    });
  });
});
