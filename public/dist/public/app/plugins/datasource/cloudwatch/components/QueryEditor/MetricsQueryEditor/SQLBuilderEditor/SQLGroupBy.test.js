import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import selectEvent from 'react-select-event';
import { setupMockedDataSource } from '../../../../__mocks__/CloudWatchDataSource';
import { createArray, createGroupBy } from '../../../../__mocks__/sqlUtils';
import { MetricEditorMode, MetricQueryType } from '../../../../types';
import SQLGroupBy from './SQLGroupBy';
const { datasource } = setupMockedDataSource();
const makeSQLQuery = (sql) => ({
    queryMode: 'Metrics',
    refId: '',
    id: '',
    region: 'us-east-1',
    namespace: 'ec2',
    dimensions: { somekey: 'somevalue' },
    metricQueryType: MetricQueryType.Query,
    metricEditorMode: MetricEditorMode.Builder,
    sql: sql,
});
datasource.resources.getDimensionKeys = jest.fn().mockResolvedValue([]);
describe('Cloudwatch SQLGroupBy', () => {
    const baseProps = {
        query: makeSQLQuery(),
        datasource,
        onQueryChange: () => { },
    };
    it('should load dimension keys with an empty dimension filter in case no group bys exist', () => __awaiter(void 0, void 0, void 0, function* () {
        const query = makeSQLQuery({
            groupBy: undefined,
        });
        render(React.createElement(SQLGroupBy, Object.assign({}, baseProps, { query: query })));
        yield waitFor(() => {
            expect(screen.queryByText('InstanceId')).not.toBeInTheDocument();
            expect(screen.queryByText('InstanceType')).not.toBeInTheDocument();
        });
    }));
    it('should load dimension keys with a dimension filter in case a group bys exist', () => __awaiter(void 0, void 0, void 0, function* () {
        const query = makeSQLQuery({
            groupBy: createArray([createGroupBy('InstanceId'), createGroupBy('InstanceType')]),
        });
        render(React.createElement(SQLGroupBy, Object.assign({}, baseProps, { query: query })));
        yield waitFor(() => {
            expect(screen.getByText('InstanceId')).toBeInTheDocument();
            expect(screen.getByText('InstanceType')).toBeInTheDocument();
        });
    }));
    it('should allow adding a new dimension filter', () => __awaiter(void 0, void 0, void 0, function* () {
        const query = makeSQLQuery({
            groupBy: undefined,
        });
        render(React.createElement(SQLGroupBy, Object.assign({}, baseProps, { query: query })));
        expect(screen.queryByText('Choose')).not.toBeInTheDocument();
        expect(screen.queryByText('Template Variables')).not.toBeInTheDocument();
        const addButton = screen.getByRole('button', { name: 'Add' });
        expect(addButton).toBeInTheDocument();
        yield userEvent.click(addButton);
        expect(screen.getByText('Choose')).toBeInTheDocument();
        selectEvent.openMenu(screen.getByLabelText(/Group by/));
        expect(screen.getByText('Template Variables')).toBeInTheDocument();
    }));
    it('should allow removing a dimension filter', () => __awaiter(void 0, void 0, void 0, function* () {
        const query = makeSQLQuery({
            groupBy: createArray([createGroupBy('InstanceId')]),
        });
        render(React.createElement(SQLGroupBy, Object.assign({}, baseProps, { query: query })));
        expect(screen.getByText('InstanceId')).toBeInTheDocument();
        const removeButton = screen.getByRole('button', { name: 'remove' });
        expect(removeButton).toBeInTheDocument();
        yield userEvent.click(removeButton);
        expect(screen.queryByText('InstanceId')).not.toBeInTheDocument();
    }));
});
//# sourceMappingURL=SQLGroupBy.test.js.map