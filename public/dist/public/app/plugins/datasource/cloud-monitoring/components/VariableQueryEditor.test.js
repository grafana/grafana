import { __awaiter } from "tslib";
import React from 'react';
// @ts-ignore
import renderer from 'react-test-renderer';
import { MetricFindQueryTypes } from '../types/query';
import { CloudMonitoringVariableQueryEditor } from './VariableQueryEditor';
jest.mock('../functions', () => ({
    getMetricTypes: () => ({ metricTypes: [], selectedMetricType: '' }),
    extractServicesFromMetricDescriptors: () => [],
}));
jest.mock('@grafana/runtime', () => {
    const original = jest.requireActual('@grafana/runtime');
    return Object.assign(Object.assign({}, original), { getTemplateSrv: () => ({
            replace: (s) => s,
            getVariables: () => [],
        }) });
});
const props = {
    onChange: (query) => { },
    query: {},
    datasource: {
        getDefaultProject: () => '',
        getProjects: () => __awaiter(void 0, void 0, void 0, function* () { return Promise.resolve([]); }),
        getMetricTypes: (projectName) => __awaiter(void 0, void 0, void 0, function* () { return Promise.resolve([]); }),
        getSLOServices: (projectName) => __awaiter(void 0, void 0, void 0, function* () { return Promise.resolve([]); }),
        getServiceLevelObjectives: (projectName, serviceId) => Promise.resolve([]),
        ensureGCEDefaultProject: () => __awaiter(void 0, void 0, void 0, function* () { return Promise.resolve(''); }),
    },
    onRunQuery: () => { },
};
describe('VariableQueryEditor', () => {
    it('renders correctly', () => {
        const tree = renderer.create(React.createElement(CloudMonitoringVariableQueryEditor, Object.assign({}, props))).toJSON();
        expect(tree).toMatchSnapshot();
    });
    describe('and a new variable is created', () => {
        it('should trigger a query using the first query type in the array', (done) => {
            props.onChange = (query) => {
                expect(query.selectedQueryType).toBe('projects');
                done();
            };
            renderer.create(React.createElement(CloudMonitoringVariableQueryEditor, Object.assign({}, props))).toJSON();
        });
    });
    describe('and an existing variable is edited', () => {
        it('should trigger new query using the saved query type', (done) => {
            props.query = { selectedQueryType: MetricFindQueryTypes.LabelKeys };
            props.onChange = (query) => {
                expect(query.selectedQueryType).toBe('labelKeys');
                done();
            };
            renderer.create(React.createElement(CloudMonitoringVariableQueryEditor, Object.assign({}, props))).toJSON();
        });
    });
});
//# sourceMappingURL=VariableQueryEditor.test.js.map