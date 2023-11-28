import { __awaiter } from "tslib";
import Prism from 'prismjs';
import { of } from 'rxjs';
import { CoreApp, } from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime';
import { extractLabelMatchers, toPromLikeExpr } from '../prometheus/language_utils';
import { VariableSupport } from './VariableSupport';
import { defaultGrafanaPyroscope, defaultPyroscopeQueryType } from './dataquery.gen';
export class PyroscopeDataSource extends DataSourceWithBackend {
    constructor(instanceSettings, templateSrv = getTemplateSrv()) {
        super(instanceSettings);
        this.templateSrv = templateSrv;
        this.variables = new VariableSupport(this);
    }
    query(request) {
        const validTargets = request.targets
            .filter((t) => t.profileTypeId)
            .map((t) => {
            // Empty string errors out but honestly seems like we can just normalize it this way
            if (t.labelSelector === '') {
                return Object.assign(Object.assign({}, t), { labelSelector: '{}' });
            }
            return normalizeQuery(t, request.app);
        });
        if (!validTargets.length) {
            return of({ data: [] });
        }
        return super.query(Object.assign(Object.assign({}, request), { targets: validTargets }));
    }
    getProfileTypes() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.getResource('profileTypes');
        });
    }
    getLabelNames(query, start, end) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.getResource('labelNames', { query: this.templateSrv.replace(query), start, end });
        });
    }
    getLabelValues(query, label, start, end) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.getResource('labelValues', {
                label: this.templateSrv.replace(label),
                query: this.templateSrv.replace(query),
                start,
                end,
            });
        });
    }
    applyTemplateVariables(query, scopedVars) {
        var _a, _b;
        return Object.assign(Object.assign({}, query), { labelSelector: this.templateSrv.replace((_a = query.labelSelector) !== null && _a !== void 0 ? _a : '', scopedVars), profileTypeId: this.templateSrv.replace((_b = query.profileTypeId) !== null && _b !== void 0 ? _b : '', scopedVars) });
    }
    importFromAbstractQueries(abstractQueries) {
        return __awaiter(this, void 0, void 0, function* () {
            return abstractQueries.map((abstractQuery) => this.importFromAbstractQuery(abstractQuery));
        });
    }
    importFromAbstractQuery(labelBasedQuery) {
        return {
            refId: labelBasedQuery.refId,
            labelSelector: toPromLikeExpr(labelBasedQuery),
            queryType: 'both',
            profileTypeId: '',
            groupBy: [],
        };
    }
    exportToAbstractQueries(queries) {
        return __awaiter(this, void 0, void 0, function* () {
            return queries.map((query) => this.exportToAbstractQuery(query));
        });
    }
    exportToAbstractQuery(query) {
        const pyroscopeQuery = query.labelSelector;
        if (!pyroscopeQuery || pyroscopeQuery.length === 0) {
            return { refId: query.refId, labelMatchers: [] };
        }
        const tokens = Prism.tokenize(pyroscopeQuery, grammar);
        return {
            refId: query.refId,
            labelMatchers: extractLabelMatchers(tokens),
        };
    }
    getDefaultQuery(app) {
        return defaultQuery;
    }
}
export const defaultQuery = Object.assign(Object.assign({}, defaultGrafanaPyroscope), { queryType: defaultPyroscopeQueryType });
export function normalizeQuery(query, app) {
    let normalized = Object.assign(Object.assign({}, defaultQuery), query);
    if (app !== CoreApp.Explore && normalized.queryType === 'both') {
        // In dashboards and other places, we can't show both types of graphs at the same time.
        // This will also be a default when having 'both' query and adding it from explore to dashboard
        normalized.queryType = 'profile';
    }
    return normalized;
}
const grammar = {
    'context-labels': {
        pattern: /\{[^}]*(?=}?)/,
        greedy: true,
        inside: {
            comment: {
                pattern: /#.*/,
            },
            'label-key': {
                pattern: /[a-zA-Z_]\w*(?=\s*(=|!=|=~|!~))/,
                alias: 'attr-name',
                greedy: true,
            },
            'label-value': {
                pattern: /"(?:\\.|[^\\"])*"/,
                greedy: true,
                alias: 'attr-value',
            },
            punctuation: /[{]/,
        },
    },
    punctuation: /[{}(),.]/,
};
//# sourceMappingURL=datasource.js.map