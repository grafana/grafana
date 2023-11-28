import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { FilterSection, testIds } from './FilterSection';
const onRunQuery = jest.fn();
const onChange = jest.fn();
const setup = (propOverrides) => {
    const suggestTagKeys = jest.fn();
    const suggestTagValues = jest.fn();
    const query = {
        metric: 'cpu',
        refId: 'A',
        downsampleAggregator: 'avg',
        downsampleFillPolicy: 'none',
        filters: [
            {
                filter: 'server1',
                groupBy: true,
                tagk: 'hostname',
                type: 'iliteral_or',
            },
        ],
    };
    const props = {
        query,
        onChange: onChange,
        onRunQuery: onRunQuery,
        suggestTagKeys: suggestTagKeys,
        filterTypes: ['literal_or'],
        suggestTagValues: suggestTagValues,
    };
    Object.assign(props, propOverrides);
    return render(React.createElement(FilterSection, Object.assign({}, props)));
};
describe('FilterSection', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('should render filter section', () => {
        setup();
        expect(screen.getByTestId(testIds.section)).toBeInTheDocument();
    });
    describe('filter editor', () => {
        it('open the editor on clicking +', () => {
            setup();
            fireEvent.click(screen.getByRole('button', { name: /Add filter/ }));
            expect(screen.getByText('Group by')).toBeInTheDocument();
        });
        it('should display a list of filters', () => {
            setup();
            expect(screen.getByTestId(testIds.list + '0')).toBeInTheDocument();
        });
        it('should call runQuery on adding a filter', () => {
            setup();
            fireEvent.click(screen.getByRole('button', { name: /Add filter/ }));
            fireEvent.click(screen.getByText('add filter'));
            expect(onRunQuery).toHaveBeenCalled();
        });
        it('should have an error if tags are present when adding a filter', () => {
            const query = {
                metric: 'cpu',
                refId: 'A',
                downsampleAggregator: 'avg',
                downsampleFillPolicy: 'none',
                tags: [{}],
            };
            setup({ query });
            fireEvent.click(screen.getByRole('button', { name: /Add filter/ }));
            fireEvent.click(screen.getByText('add filter'));
            expect(screen.getByTestId(testIds.error)).toBeInTheDocument();
        });
        it('should remove a filter', () => {
            var _a;
            const query = {
                metric: 'cpu',
                refId: 'A',
                downsampleAggregator: 'avg',
                downsampleFillPolicy: 'none',
                filters: [
                    {
                        filter: 'server1',
                        groupBy: true,
                        tagk: 'hostname',
                        type: 'iliteral_or',
                    },
                ],
            };
            setup({ query });
            fireEvent.click(screen.getByTestId(testIds.remove));
            expect(((_a = query.filters) === null || _a === void 0 ? void 0 : _a.length) === 0).toBeTruthy();
        });
    });
});
//# sourceMappingURL=FilterSection.test.js.map