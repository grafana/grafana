import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import selectEvent from 'react-select-event';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { initialVariableModelState } from '../../../../../../features/variables/types';
import { CloudWatchDatasource } from '../../../datasource';
import { MetricEditorMode, MetricQueryType } from '../../../types';
import { MetricsQueryEditor } from './MetricsQueryEditor';
jest.mock('@grafana/ui', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/ui')), { CodeEditor: function CodeEditor({ value }) {
        return React.createElement("pre", null, value);
    } })));
const setup = () => {
    const instanceSettings = {
        jsonData: { defaultRegion: 'us-east-1' },
    };
    const templateSrv = new TemplateSrv();
    const variable = Object.assign(Object.assign({}, initialVariableModelState), { id: 'var3', index: 0, name: 'var3', options: [
            { selected: true, value: 'var3-foo', text: 'var3-foo' },
            { selected: false, value: 'var3-bar', text: 'var3-bar' },
            { selected: true, value: 'var3-baz', text: 'var3-baz' },
        ], current: { selected: true, value: ['var3-foo', 'var3-baz'], text: 'var3-foo + var3-baz' }, multi: true, includeAll: false, query: '', type: 'custom' });
    templateSrv.init([variable]);
    const datasource = new CloudWatchDatasource(instanceSettings, templateSrv, {});
    datasource.metricFindQuery = () => __awaiter(void 0, void 0, void 0, function* () { return [{ value: 'test', label: 'test', text: 'test' }]; });
    datasource.resources.getNamespaces = jest.fn().mockResolvedValue([]);
    datasource.resources.getMetrics = jest.fn().mockResolvedValue([]);
    datasource.resources.getRegions = jest.fn().mockResolvedValue([]);
    datasource.resources.getDimensionKeys = jest.fn().mockResolvedValue([]);
    datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(false);
    const props = {
        query: {
            queryMode: 'Metrics',
            refId: '',
            id: '',
            region: 'us-east-1',
            namespace: 'ec2',
            metricName: 'CPUUtilization',
            dimensions: { somekey: 'somevalue' },
            statistic: '',
            period: '',
            expression: '',
            alias: '',
            matchExact: true,
            metricQueryType: MetricQueryType.Search,
            metricEditorMode: MetricEditorMode.Builder,
        },
        extraHeaderElementLeft: () => { },
        extraHeaderElementRight: () => { },
        datasource,
        history: [],
        onChange: jest.fn(),
        onRunQuery: jest.fn(),
    };
    return props;
};
describe('QueryEditor', () => {
    describe('should handle expression options correctly', () => {
        it('should display match exact switch', () => __awaiter(void 0, void 0, void 0, function* () {
            const props = setup();
            render(React.createElement(MetricsQueryEditor, Object.assign({}, props)));
            expect(yield screen.findByText('Match exact')).toBeInTheDocument();
        }));
        it('should display wildcard option in dimension value dropdown', () => __awaiter(void 0, void 0, void 0, function* () {
            const props = setup();
            if (props.query.queryMode !== 'Metrics') {
                fail(`expected props.query.queryMode to be 'Metrics', got '${props.query.queryMode}' instead`);
            }
            props.datasource.resources.getDimensionValues = jest
                .fn()
                .mockResolvedValue([[{ label: 'dimVal1', value: 'dimVal1' }]]);
            props.query.metricQueryType = MetricQueryType.Search;
            props.query.metricEditorMode = MetricEditorMode.Builder;
            props.query.dimensions = { instanceId: 'instance-123' };
            render(React.createElement(MetricsQueryEditor, Object.assign({}, props)));
            expect(screen.getByText('Match exact')).toBeInTheDocument();
            expect(screen.getByText('instance-123')).toBeInTheDocument();
            expect(screen.queryByText('*')).toBeNull();
            selectEvent.openMenu(screen.getByLabelText('Dimensions filter value'));
            expect(yield screen.findByText('*')).toBeInTheDocument();
        }));
    });
    it('should render label field and not alias field', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = setup();
        render(React.createElement(MetricsQueryEditor, Object.assign({}, props, { query: Object.assign(Object.assign({}, props.query), { refId: 'A', alias: 'Period: {{period}} InstanceId: {{InstanceId}}' }) })));
        expect(yield screen.findByText('Label')).toBeInTheDocument();
        expect(screen.queryByText('Alias')).toBeNull();
        expect(screen.getByText("Period: ${PROP('Period')} InstanceId: ${PROP('Dim.InstanceId')}"));
    }));
});
//# sourceMappingURL=MetricsQueryEditor.test.js.map