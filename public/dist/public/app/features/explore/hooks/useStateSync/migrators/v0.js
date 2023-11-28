import { safeParseJson } from 'app/core/utils/explore';
import { DEFAULT_RANGE } from 'app/features/explore/state/utils';
export const v0Migrator = {
    parse: (params) => {
        return Object.assign({ schemaVersion: 0, left: parseUrlState(typeof params.left === 'string' ? params.left : undefined) }, (params.right && {
            right: parseUrlState(typeof params.right === 'string' ? params.right : undefined),
        }));
    },
};
const isSegment = (segment, ...props) => props.some((prop) => segment.hasOwnProperty(prop));
var ParseUrlStateIndex;
(function (ParseUrlStateIndex) {
    ParseUrlStateIndex[ParseUrlStateIndex["RangeFrom"] = 0] = "RangeFrom";
    ParseUrlStateIndex[ParseUrlStateIndex["RangeTo"] = 1] = "RangeTo";
    ParseUrlStateIndex[ParseUrlStateIndex["Datasource"] = 2] = "Datasource";
    ParseUrlStateIndex[ParseUrlStateIndex["SegmentsStart"] = 3] = "SegmentsStart";
})(ParseUrlStateIndex || (ParseUrlStateIndex = {}));
function parseUrlState(initial) {
    var _a;
    const parsed = safeParseJson(initial);
    const errorResult = {
        datasource: null,
        queries: [],
        range: DEFAULT_RANGE,
    };
    if (!parsed) {
        return errorResult;
    }
    if (!Array.isArray(parsed)) {
        return Object.assign({ queries: [], range: DEFAULT_RANGE }, parsed);
    }
    if (parsed.length <= ParseUrlStateIndex.SegmentsStart) {
        console.error('Error parsing compact URL state for Explore.');
        return errorResult;
    }
    const range = {
        from: parsed[ParseUrlStateIndex.RangeFrom],
        to: parsed[ParseUrlStateIndex.RangeTo],
    };
    const datasource = parsed[ParseUrlStateIndex.Datasource];
    const parsedSegments = parsed.slice(ParseUrlStateIndex.SegmentsStart);
    const queries = parsedSegments.filter((segment) => !isSegment(segment, 'ui', 'mode', '__panelsState'));
    const panelsState = (_a = parsedSegments.find((segment) => isSegment(segment, '__panelsState'))) === null || _a === void 0 ? void 0 : _a.__panelsState;
    return { datasource, queries, range, panelsState };
}
//# sourceMappingURL=v0.js.map