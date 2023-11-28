import { isValidElement } from 'react';
export function messageFromElement(error) {
    if (isValidElement(error)) {
        return error;
    }
    else {
        return messageFromError(error);
    }
}
export default function messageFromError(error) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
    if (!error || typeof error !== 'object') {
        return undefined;
    }
    if (typeof error.message === 'string') {
        return error.message;
    }
    if (typeof ((_b = (_a = error.data) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.message) === 'string') {
        return error.data.error.message;
    }
    // Copied from the old Angular code - this might be checking for errors in places
    // that the new code just doesnt use.
    // As new error objects are discovered they should be added to the above code, rather
    // than below
    const maybeAMessage = ((_g = (_f = (_e = (_d = (_c = error.error) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.error) === null || _e === void 0 ? void 0 : _e.innererror) === null || _f === void 0 ? void 0 : _f.innererror) === null || _g === void 0 ? void 0 : _g.message) ||
        ((_l = (_k = (_j = (_h = error.error) === null || _h === void 0 ? void 0 : _h.data) === null || _j === void 0 ? void 0 : _j.error) === null || _k === void 0 ? void 0 : _k.innererror) === null || _l === void 0 ? void 0 : _l.message) ||
        ((_p = (_o = (_m = error.error) === null || _m === void 0 ? void 0 : _m.data) === null || _o === void 0 ? void 0 : _o.error) === null || _p === void 0 ? void 0 : _p.message) ||
        ((_r = (_q = error.error) === null || _q === void 0 ? void 0 : _q.data) === null || _r === void 0 ? void 0 : _r.message) ||
        ((_s = error.data) === null || _s === void 0 ? void 0 : _s.message) ||
        error;
    if (typeof maybeAMessage === 'string') {
        return maybeAMessage;
    }
    else if (maybeAMessage && maybeAMessage.toString) {
        return maybeAMessage.toString();
    }
    return undefined;
}
//# sourceMappingURL=messageFromError.js.map