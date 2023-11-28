import { LegacyVariableQueryEditor } from './LegacyVariableQueryEditor';
import { initialVariableEditorState, } from './reducer';
import { getAdhocVariableEditorState, getDatasourceVariableEditorState, getQueryVariableEditorState, } from './selectors';
const adhocExtended = {
    infoText: 'infoText',
};
const datasourceExtended = {
    dataSourceTypes: [
        { text: 'Prometheus', value: 'ds-prom' },
        { text: 'Loki', value: 'ds-loki' },
    ],
};
const queryExtended = {
    VariableQueryEditor: LegacyVariableQueryEditor,
    dataSource: {},
};
const adhocVariableState = Object.assign(Object.assign({}, initialVariableEditorState), { extended: adhocExtended });
const datasourceVariableState = Object.assign(Object.assign({}, initialVariableEditorState), { extended: datasourceExtended });
const queryVariableState = Object.assign(Object.assign({}, initialVariableEditorState), { extended: queryExtended });
describe('getAdhocVariableEditorState', () => {
    it('returns the extended properties for adhoc variable state', () => {
        expect(getAdhocVariableEditorState(adhocVariableState)).toBe(adhocExtended);
    });
    it('returns null for datasource variable state', () => {
        expect(getAdhocVariableEditorState(datasourceVariableState)).toBeNull();
    });
    it('returns null for query variable state', () => {
        expect(getAdhocVariableEditorState(queryVariableState)).toBeNull();
    });
});
describe('getDatasourceVariableEditorState', () => {
    it('returns the extended properties for datasource variable state', () => {
        expect(getDatasourceVariableEditorState(datasourceVariableState)).toBe(datasourceExtended);
    });
    it('returns null for adhoc variable state', () => {
        expect(getDatasourceVariableEditorState(adhocVariableState)).toBeNull();
    });
    it('returns null for query variable state', () => {
        expect(getDatasourceVariableEditorState(queryVariableState)).toBeNull();
    });
});
describe('getQueryVariableEditorState', () => {
    it('returns the extended properties for query variable state', () => {
        expect(getQueryVariableEditorState(queryVariableState)).toBe(queryExtended);
    });
    it('returns null for adhoc variable state', () => {
        expect(getQueryVariableEditorState(adhocVariableState)).toBeNull();
    });
    it('returns null for datasource variable state', () => {
        expect(getQueryVariableEditorState(datasourceVariableState)).toBeNull();
    });
});
//# sourceMappingURL=selectors.test.js.map