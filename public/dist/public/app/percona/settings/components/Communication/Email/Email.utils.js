import { EmailAuthType } from '../../../Settings.types';
export const isEmailFieldNeeded = (field, authType) => {
    let needingAuths = [];
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
export const getAuthTypeFromFields = (settings) => {
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
export const getInitialValues = (settings) => {
    const authType = getAuthTypeFromFields(settings);
    const settingsCopy = Object.assign({}, settings);
    delete settingsCopy.secret;
    delete settingsCopy.identity;
    delete settingsCopy.require_tls;
    const resultSettings = Object.assign(Object.assign({}, settingsCopy), { hello: settings.hello || 'localhost', password: authType === EmailAuthType.CRAM ? settings.secret : settings.password, authType, requireTls: !!settings.require_tls });
    return resultSettings;
};
export const cleanupFormValues = (values) => {
    const baseSettings = Object.assign(Object.assign({}, values), { require_tls: values.requireTls });
    if (values.authType === EmailAuthType.PLAIN) {
        baseSettings.identity = btoa(`${values.username}${values.password}`);
    }
    else if (values.authType === EmailAuthType.CRAM) {
        baseSettings.secret = baseSettings.password;
    }
    Object.keys(baseSettings).forEach((field) => {
        if (field !== 'require_tls' && !isEmailFieldNeeded(field, values.authType)) {
            delete baseSettings[field];
        }
    });
    return baseSettings;
};
//# sourceMappingURL=Email.utils.js.map