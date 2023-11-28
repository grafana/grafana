import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { PrometheusDatasource } from '../../datasource';
import { EmptyLanguageProviderMock } from '../../language_provider.mock';
import { promQueryModeller } from '../PromQueryModeller';
import { OperationList } from './OperationList';
import { addOperation } from './OperationList.testUtils';
const defaultQuery = {
    metric: 'random_metric',
    labels: [{ label: 'instance', op: '=', value: 'localhost:9090' }],
    operations: [
        {
            id: 'rate',
            params: ['auto'],
        },
        {
            id: '__sum_by',
            params: ['instance', 'job'],
        },
    ],
};
describe('OperationList', () => {
    it('renders operations', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        expect(screen.getByText('Rate')).toBeInTheDocument();
        expect(screen.getByText('Sum by')).toBeInTheDocument();
    }));
    it('removes an operation', () => __awaiter(void 0, void 0, void 0, function* () {
        const { onChange } = setup();
        const removeOperationButtons = screen.getAllByTitle('Remove operation');
        expect(removeOperationButtons).toHaveLength(2);
        yield userEvent.click(removeOperationButtons[1]);
        expect(onChange).toBeCalledWith({
            labels: [{ label: 'instance', op: '=', value: 'localhost:9090' }],
            metric: 'random_metric',
            operations: [{ id: 'rate', params: ['auto'] }],
        });
    }));
    it('adds an operation', () => __awaiter(void 0, void 0, void 0, function* () {
        const { onChange } = setup();
        yield addOperation('Aggregations', 'Min');
        expect(onChange).toBeCalledWith({
            labels: [{ label: 'instance', op: '=', value: 'localhost:9090' }],
            metric: 'random_metric',
            operations: [
                { id: 'rate', params: ['auto'] },
                { id: '__sum_by', params: ['instance', 'job'] },
                { id: 'min', params: [] },
            ],
        });
    }));
});
function setup(query = defaultQuery) {
    const languageProvider = new EmptyLanguageProviderMock();
    const props = {
        datasource: new PrometheusDatasource({
            url: '',
            jsonData: {},
            meta: {},
        }, undefined, undefined, languageProvider),
        onRunQuery: () => { },
        onChange: jest.fn(),
        queryModeller: promQueryModeller,
    };
    render(React.createElement(OperationList, Object.assign({}, props, { query: query })));
    return props;
}
//# sourceMappingURL=OperationList.test.js.map