import { generateExploreId, safeParseJson } from 'app/core/utils/explore';
import { DEFAULT_RANGE } from 'app/features/explore/state/utils';
import { hasKey } from '../../utils';
export const v1Migrator = {
    parse: (params) => {
        if (!params || !params.panes || typeof params.panes !== 'string') {
            return {
                schemaVersion: 1,
                panes: {
                    [generateExploreId()]: DEFAULT_STATE,
                },
            };
        }
        const rawPanes = safeParseJson(params.panes) || {};
        const panes = Object.entries(rawPanes)
            .map(([key, value]) => [key, applyDefaults(value)])
            .reduce((acc, [key, value]) => {
            return Object.assign(Object.assign({}, acc), { [key]: value });
        }, {});
        if (!Object.keys(panes).length) {
            panes[generateExploreId()] = DEFAULT_STATE;
        }
        return {
            schemaVersion: 1,
            panes,
        };
    },
    migrate: (params) => {
        return {
            schemaVersion: 1,
            panes: Object.assign({ [generateExploreId()]: params.left }, (params.right && { [generateExploreId()]: params.right })),
        };
    },
};
const DEFAULT_STATE = {
    datasource: null,
    queries: [],
    range: DEFAULT_RANGE,
};
function applyDefaults(input) {
    if (!input || typeof input !== 'object') {
        return DEFAULT_STATE;
    }
    return Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, DEFAULT_STATE), (hasKey('queries', input) && Array.isArray(input.queries) && { queries: input.queries })), (hasKey('datasource', input) && typeof input.datasource === 'string' && { datasource: input.datasource })), (hasKey('panelsState', input) &&
        !!input.panelsState &&
        typeof input.panelsState === 'object' && { panelsState: input.panelsState })), (hasKey('range', input) &&
        !!input.range &&
        typeof input.range === 'object' &&
        hasKey('from', input.range) &&
        hasKey('to', input.range) &&
        typeof input.range.from === 'string' &&
        typeof input.range.to === 'string' && { range: { from: input.range.from, to: input.range.to } }));
}
//# sourceMappingURL=v1.js.map