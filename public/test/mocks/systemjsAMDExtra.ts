// the systemjs amd extra is required for loading AMD formatted plugins at runtime
// however it makes changes to global.define which breaks tests with errors similar to:
// TypeError: tslib_1.__importDefault is not a function
//
export const systemjsAMDExtra = 'systemjsAMDExtra';
