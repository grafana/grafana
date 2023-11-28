import { __awaiter } from "tslib";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { createLokiDatasource } from '../../mocks';
import { NestedQuery } from './NestedQuery';
const createMockProps = (operator = '/', vectorMatchesType = 'on', showExplain = false) => {
    const nestedQuery = {
        operator: operator,
        vectorMatchesType: vectorMatchesType,
        query: {
            labels: [],
            operations: [],
        },
    };
    const datasource = createLokiDatasource();
    const props = {
        nestedQuery: nestedQuery,
        index: 0,
        datasource: datasource,
        onChange: jest.fn(),
        onRemove: jest.fn(),
        onRunQuery: jest.fn(),
        showExplain: showExplain,
    };
    return props;
};
// All test assertions need to be awaited for, because the component uses `useEffect` to update the state.
describe('render all elements', () => {
    it('renders the operator label', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = createMockProps();
        render(React.createElement(NestedQuery, Object.assign({}, props)));
        expect(yield screen.findByText('Operator')).toBeInTheDocument();
    }));
    it('renders the expected operator value', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = createMockProps('!=');
        render(React.createElement(NestedQuery, Object.assign({}, props)));
        expect(yield screen.findByText('!=')).toBeInTheDocument();
    }));
    it('renders the vector matches label', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = createMockProps();
        render(React.createElement(NestedQuery, Object.assign({}, props)));
        expect(yield screen.findByText('Vector matches')).toBeInTheDocument();
    }));
    it('renders the expected vector matches value', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = createMockProps(undefined, 'ignoring');
        render(React.createElement(NestedQuery, Object.assign({}, props)));
        expect(yield screen.findByText('ignoring')).toBeInTheDocument();
    }));
});
describe('exit the nested query', () => {
    it('onRemove is called when clicking (x)', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = createMockProps();
        render(React.createElement(NestedQuery, Object.assign({}, props)));
        fireEvent.click(yield screen.findByLabelText('Remove nested query'));
        yield waitFor(() => expect(props.onRemove).toHaveBeenCalledTimes(1));
    }));
});
describe('change operator', () => {
    it('onChange is called with the correct args', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = createMockProps('/', 'on');
        render(React.createElement(NestedQuery, Object.assign({}, props)));
        userEvent.click(yield screen.findByLabelText('Select operator'));
        fireEvent.click(yield screen.findByText('+'));
        yield waitFor(() => expect(props.onChange).toHaveBeenCalledTimes(1));
        yield waitFor(() => expect(props.onChange).toHaveBeenCalledWith(0, {
            operator: '+',
            vectorMatchesType: 'on',
            query: { labels: [], operations: [] },
        }));
    }));
});
describe('explain mode', () => {
    it('shows the explanation when set to true', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = createMockProps(undefined, undefined, true);
        render(React.createElement(NestedQuery, Object.assign({}, props)));
        expect(yield screen.findByText('Fetch all log lines matching label filters.')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=NestedQuery.test.js.map