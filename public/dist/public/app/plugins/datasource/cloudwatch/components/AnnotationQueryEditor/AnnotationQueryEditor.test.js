import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { setupMockedDataSource } from '../../__mocks__/CloudWatchDataSource';
import { AnnotationQueryEditor } from './AnnotationQueryEditor';
const ds = setupMockedDataSource({
    variables: [],
});
const q = {
    queryMode: 'Annotations',
    region: 'us-east-2',
    namespace: '',
    period: '',
    metricName: '',
    dimensions: {},
    matchExact: true,
    statistic: '',
    refId: '',
    prefixMatching: false,
    actionPrefix: '',
    alarmNamePrefix: '',
};
ds.datasource.resources.getRegions = jest.fn().mockResolvedValue([]);
ds.datasource.resources.getNamespaces = jest.fn().mockResolvedValue([]);
ds.datasource.resources.getMetrics = jest.fn().mockResolvedValue([]);
ds.datasource.resources.getDimensionKeys = jest.fn().mockResolvedValue([]);
ds.datasource.getVariables = jest.fn().mockReturnValue([]);
const props = {
    datasource: ds.datasource,
    query: q,
    onChange: jest.fn(),
    onRunQuery: jest.fn(),
};
describe('AnnotationQueryEditor', () => {
    it('should not display match exact switch', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(AnnotationQueryEditor, Object.assign({}, props)));
        yield waitFor(() => {
            expect(screen.queryByText('Match exact')).toBeNull();
        });
    }));
    it('should return an error component in case CloudWatchQuery is not CloudWatchAnnotationQuery', () => __awaiter(void 0, void 0, void 0, function* () {
        ds.datasource.resources.getDimensionValues = jest
            .fn()
            .mockResolvedValue([[{ label: 'dimVal1', value: 'dimVal1' }]]);
        render(React.createElement(AnnotationQueryEditor, Object.assign({}, props, { query: Object.assign(Object.assign({}, props.query), { queryMode: 'Metrics' }) })));
        yield waitFor(() => expect(screen.getByText('Invalid annotation query')).toBeInTheDocument());
    }));
    it('should not display wildcard option in dimension value dropdown', () => __awaiter(void 0, void 0, void 0, function* () {
        ds.datasource.resources.getDimensionValues = jest
            .fn()
            .mockResolvedValue([[{ label: 'dimVal1', value: 'dimVal1' }]]);
        props.query.dimensions = { instanceId: 'instance-123' };
        render(React.createElement(AnnotationQueryEditor, Object.assign({}, props)));
        const valueElement = screen.getByText('instance-123');
        expect(valueElement).toBeInTheDocument();
        expect(screen.queryByText('*')).toBeNull();
        valueElement.click();
        yield waitFor(() => {
            expect(screen.queryByText('*')).toBeNull();
        });
    }));
    it('should not display Accounts component', () => __awaiter(void 0, void 0, void 0, function* () {
        ds.datasource.resources.getDimensionValues = jest
            .fn()
            .mockResolvedValue([[{ label: 'dimVal1', value: 'dimVal1' }]]);
        props.query.dimensions = { instanceId: 'instance-123' };
        yield waitFor(() => render(React.createElement(AnnotationQueryEditor, Object.assign({}, props))));
        expect(yield screen.queryByText('Account')).toBeNull();
    }));
});
//# sourceMappingURL=AnnotationQueryEditor.test.js.map