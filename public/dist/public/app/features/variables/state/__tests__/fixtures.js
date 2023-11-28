import { LoadingState, VariableHide, VariableRefresh, VariableSort, } from '@grafana/data';
function createBaseVariableModel(type) {
    return {
        name: 'myVariableName',
        id: '0',
        rootStateKey: 'key',
        global: false,
        hide: VariableHide.dontHide,
        skipUrlSync: false,
        index: 0,
        state: LoadingState.NotStarted,
        error: null,
        description: null,
        type,
    };
}
export function createVariableOption(value, rest = {}) {
    var _a, _b;
    return {
        value,
        text: (_a = rest.text) !== null && _a !== void 0 ? _a : value,
        selected: (_b = rest.selected) !== null && _b !== void 0 ? _b : false,
    };
}
export function createQueryVariable(input = {}) {
    return Object.assign(Object.assign(Object.assign({}, createBaseVariableModel('query')), { label: 'DefaultLabel', datasource: {
            uid: 'abc-123',
            type: 'prometheus',
        }, definition: 'def', sort: VariableSort.alphabeticalAsc, query: 'label_values(job)', regex: '', refresh: VariableRefresh.onDashboardLoad, multi: false, includeAll: false, current: createVariableOption('prom-prod', { text: 'Prometheus (main)', selected: true }), options: [
            createVariableOption('prom-prod', { text: 'Prometheus (main)', selected: true }),
            createVariableOption('prom-dev'),
        ] }), input);
}
export function createAdhocVariable(input) {
    return Object.assign(Object.assign(Object.assign({}, createBaseVariableModel('adhoc')), { datasource: {
            uid: 'abc-123',
            type: 'prometheus',
        }, filters: [] }), input);
}
export function createConstantVariable(input = {}) {
    return Object.assign(Object.assign(Object.assign({}, createBaseVariableModel('constant')), { query: '', current: createVariableOption('database'), options: [], hide: VariableHide.hideVariable }), input);
}
export function createDatasourceVariable(input = {}) {
    return Object.assign(Object.assign(Object.assign({}, createBaseVariableModel('datasource')), { regex: '', refresh: VariableRefresh.onDashboardLoad, multi: false, includeAll: false, query: '', current: createVariableOption('prom-prod', { text: 'Prometheus (main)', selected: true }), options: [
            createVariableOption('prom-prod', { text: 'Prometheus (main)', selected: true }),
            createVariableOption('prom-dev'),
        ] }), input);
}
export function createIntervalVariable(input = {}) {
    return Object.assign(Object.assign(Object.assign({}, createBaseVariableModel('interval')), { auto: false, auto_count: 30, auto_min: '10s', refresh: VariableRefresh.onTimeRangeChanged, query: '1m,10m,30m,1h,6h,12h,1d,7d,14d,30d', options: [], current: createVariableOption('10m') }), input);
}
export function createTextBoxVariable(input = {}) {
    return Object.assign(Object.assign(Object.assign({}, createBaseVariableModel('textbox')), { originalQuery: null, query: '', current: createVariableOption('prom-prod'), options: [] }), input);
}
export function createUserVariable(input = {}) {
    return Object.assign(Object.assign(Object.assign({}, createBaseVariableModel('system')), { current: {
            value: {
                login: 'biggus-chungus',
                id: 0,
                email: 'chungus@example.com',
            },
        } }), input);
}
export function createOrgVariable(input = {}) {
    return Object.assign(Object.assign(Object.assign({}, createBaseVariableModel('system')), { current: {
            value: {
                name: 'Big Chungus Corp.',
                id: 3,
            },
        } }), input);
}
export function createDashboardVariable(input = {}) {
    return Object.assign(Object.assign(Object.assign({}, createBaseVariableModel('system')), { current: {
            value: {
                name: 'Chungus Monitoring',
                uid: 'b1g',
            },
        } }), input);
}
export function createCustomVariable(input = {}) {
    return Object.assign(Object.assign(Object.assign({}, createBaseVariableModel('custom')), { multi: false, includeAll: false, current: createVariableOption('prom-prod', { text: 'Prometheus (main)', selected: true }), options: [], query: '' }), input);
}
//# sourceMappingURL=fixtures.js.map