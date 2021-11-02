import { isString } from 'lodash';
export function getMessageFromError(err) {
    if (err && !isString(err)) {
        if (err.message) {
            return err.message;
        }
        else if (err.data && err.data.message) {
            return err.data.message;
        }
        else if (err.statusText) {
            return err.statusText;
        }
        else {
            return JSON.stringify(err);
        }
    }
    return err;
}
//# sourceMappingURL=errors.js.map