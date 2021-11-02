import { FrameMatcherID } from './ids';
import { stringToJsRegex } from '../../text';
// General Field matcher
var refIdMacher = {
    id: FrameMatcherID.byRefId,
    name: 'Query refId',
    description: 'match the refId',
    defaultOptions: 'A',
    get: function (pattern) {
        var regex = stringToJsRegex(pattern);
        return function (frame) {
            return regex.test(frame.refId || '');
        };
    },
    getOptionsDisplayText: function (pattern) {
        return "RefID: " + pattern;
    },
};
export function getRefIdMatchers() {
    return [refIdMacher];
}
//# sourceMappingURL=refIdMatcher.js.map