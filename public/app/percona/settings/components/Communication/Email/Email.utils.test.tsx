import { EmailAuthType } from 'app/percona/settings/Settings.types';
import { FormEmailSettings } from './Email.types';
import { isEmailFieldNeeded, getAuthTypeFromFields, getInitialValues, cleanupFormValues } from './Email.utils';

describe('Communication::Email::utils', () => {
  describe('isEmailFieldNeeded', () => {
    it('should return true for common fields', () => {
      expect(isEmailFieldNeeded('smarthost', EmailAuthType.NONE)).toBe(true);
      expect(isEmailFieldNeeded('hello', EmailAuthType.LOGIN)).toBe(true);
      expect(isEmailFieldNeeded('from', EmailAuthType.PLAIN)).toBe(true);
    });

    it('should return false for unneeded fields', () => {
      expect(isEmailFieldNeeded('password', EmailAuthType.NONE)).toBe(false);
      expect(isEmailFieldNeeded('identity', EmailAuthType.LOGIN)).toBe(false);
      expect(isEmailFieldNeeded('secret', EmailAuthType.LOGIN)).toBe(false);
    });

    it('should return true for needed fields', () => {
      expect(isEmailFieldNeeded('password', EmailAuthType.LOGIN)).toBe(true);
      expect(isEmailFieldNeeded('password', EmailAuthType.PLAIN)).toBe(true);
      expect(isEmailFieldNeeded('identity', EmailAuthType.PLAIN)).toBe(true);
      expect(isEmailFieldNeeded('secret', EmailAuthType.CRAM)).toBe(true);
    });
  });

  describe('getAuthTypeFromFields', () => {
    it('should return PLAIN when there is identity', () => {
      expect(
        getAuthTypeFromFields({
          identity: 'ident_sample',
          from: 'from@mail.com',
          smarthost: 'host.com',
          hello: 'hello',
        })
      ).toBe(EmailAuthType.PLAIN);
    });

    it('should return CRAM-MD5 when there is secret', () => {
      expect(
        getAuthTypeFromFields({
          secret: 'secret',
          from: 'from@mail.com',
          smarthost: 'host.com',
          hello: 'hello',
        })
      ).toBe(EmailAuthType.CRAM);
    });

    it('should return LOGIN when there is username but no identity', () => {
      expect(
        getAuthTypeFromFields({
          username: 'username',
          from: 'from@mail.com',
          smarthost: 'host.com',
          hello: 'hello',
        })
      ).toBe(EmailAuthType.LOGIN);
    });

    it('should return NONE when only common fields are present', () => {
      expect(
        getAuthTypeFromFields({
          from: 'from@mail.com',
          smarthost: 'host.com',
          hello: 'hello',
        })
      ).toBe(EmailAuthType.NONE);
    });
  });

  describe('getInitialValues', () => {
    it('should return authType and remove identity', () => {
      expect(
        getInitialValues({
          from: 'from@mail.com',
          smarthost: 'host.com',
          hello: 'hello',
          username: 'user',
          password: 'pass',
          identity: 'ident',
        })
      ).toEqual<FormEmailSettings>({
        from: 'from@mail.com',
        smarthost: 'host.com',
        hello: 'hello',
        username: 'user',
        password: 'pass',
        authType: EmailAuthType.PLAIN,
      });
    });
  });

  describe('cleanupFormValues', () => {
    it('should take form values and return only necessary fields', () => {
      spyOn(window, 'btoa').and.returnValue('fakeBtoa');
      expect(
        cleanupFormValues({
          from: 'from@mail.com',
          smarthost: 'host.com',
          hello: 'hello',
          username: 'user',
          password: 'pass',
          authType: EmailAuthType.LOGIN,
        })
      ).toEqual({
        from: 'from@mail.com',
        smarthost: 'host.com',
        hello: 'hello',
        username: 'user',
        password: 'pass',
      });

      expect(
        cleanupFormValues({
          from: 'from@mail.com',
          smarthost: 'host.com',
          hello: 'hello',
          username: 'user',
          password: 'pass',
          authType: EmailAuthType.PLAIN,
        })
      ).toEqual({
        from: 'from@mail.com',
        smarthost: 'host.com',
        hello: 'hello',
        username: 'user',
        password: 'pass',
        identity: 'fakeBtoa',
      });

      expect(
        cleanupFormValues({
          from: 'from@mail.com',
          smarthost: 'host.com',
          hello: 'hello',
          username: 'user',
          password: 'pass',
          authType: EmailAuthType.CRAM,
        })
      ).toEqual({
        from: 'from@mail.com',
        smarthost: 'host.com',
        hello: 'hello',
        username: 'user',
        secret: 'pass',
      });

      expect(
        cleanupFormValues({
          from: 'from@mail.com',
          smarthost: 'host.com',
          hello: 'hello',
          username: 'user',
          password: 'pass',
          authType: EmailAuthType.NONE,
        })
      ).toEqual({
        from: 'from@mail.com',
        smarthost: 'host.com',
        hello: 'hello',
      });
    });
  });
});
