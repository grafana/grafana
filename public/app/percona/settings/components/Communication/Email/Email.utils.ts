import { EmailSettings, EmailAuthType } from '../../../Settings.types';
import { FormEmailSettings } from './Email.types';

export const isEmailFieldNeeded = (field: keyof EmailSettings, authType: EmailAuthType): boolean => {
  let needingAuths: EmailAuthType[] = [];

  switch (field) {
    case 'username':
      needingAuths = [EmailAuthType.CRAM, EmailAuthType.LOGIN, EmailAuthType.PLAIN];
      break;
    case 'password':
      needingAuths = [EmailAuthType.LOGIN, EmailAuthType.PLAIN];
      break;
    case 'secret':
      needingAuths = [EmailAuthType.CRAM];
      break;
    case 'identity':
      needingAuths = [EmailAuthType.PLAIN];
      break;
    case 'smarthost':
    case 'from':
    case 'hello':
      needingAuths = [EmailAuthType.CRAM, EmailAuthType.LOGIN, EmailAuthType.PLAIN, EmailAuthType.NONE];
      break;
    default:
      break;
  }

  return needingAuths.length > 0 && needingAuths.includes(authType);
};

export const getAuthTypeFromFields = (settings: EmailSettings): EmailAuthType => {
  if (settings.identity) {
    return EmailAuthType.PLAIN;
  }

  if (settings.secret) {
    return EmailAuthType.CRAM;
  }

  if (settings.username) {
    return EmailAuthType.LOGIN;
  }

  return EmailAuthType.NONE;
};

export const getInitialValues = (settings: EmailSettings): FormEmailSettings => {
  const authType = getAuthTypeFromFields(settings);
  const settingsCopy = { ...settings };
  delete settingsCopy.secret;
  delete settingsCopy.identity;
  const resultSettings: FormEmailSettings = {
    ...settingsCopy,
    hello: settings.hello || 'localhost',
    password: authType === EmailAuthType.CRAM ? settings.secret : settings.password,
    authType,
  };

  return resultSettings;
};

export const cleanupFormValues = (values: FormEmailSettings): EmailSettings => {
  const baseSettings: EmailSettings = { ...values };

  if (values.authType === EmailAuthType.PLAIN) {
    baseSettings.identity = btoa(`${values.username}${values.password}`);
  } else if (values.authType === EmailAuthType.CRAM) {
    baseSettings.secret = baseSettings.password;
  }

  Object.keys(baseSettings).forEach((field: keyof EmailSettings) => {
    if (!isEmailFieldNeeded(field, values.authType)) {
      delete baseSettings[field];
    }
  });

  return baseSettings;
};
