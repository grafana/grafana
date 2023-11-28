import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { lokiQueryModeller } from '../LokiQueryModeller';
import { LokiQueryPatternType } from '../types';
import { QueryPatternsModal } from './QueryPatternsModal';
// don't care about interaction tracking in our unit tests
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { reportInteraction: jest.fn() })));
const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onChange: jest.fn(),
    onAddQuery: jest.fn(),
    query: {
        refId: 'A',
        expr: '{label1="foo", label2="bar"} |= "baz" |~ "qux"',
    },
    queries: [
        {
            refId: 'A',
            expr: '{label1="foo", label2="bar"}',
        },
    ],
};
const queryPatterns = {
    logQueryPatterns: lokiQueryModeller.getQueryPatterns().filter((pattern) => pattern.type === LokiQueryPatternType.Log),
    metricQueryPatterns: lokiQueryModeller
        .getQueryPatterns()
        .filter((pattern) => pattern.type === LokiQueryPatternType.Metric),
};
describe('QueryPatternsModal', () => {
    it('renders the modal', () => {
        render(React.createElement(QueryPatternsModal, Object.assign({}, defaultProps)));
        expect(screen.getByText('Kick start your query')).toBeInTheDocument();
    });
    it('renders collapsible elements with all query pattern types', () => {
        render(React.createElement(QueryPatternsModal, Object.assign({}, defaultProps)));
        Object.values(LokiQueryPatternType).forEach((pattern) => {
            expect(screen.getByText(new RegExp(`${pattern} query starters`, 'i'))).toBeInTheDocument();
        });
    });
    it('can open and close query patterns section', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(QueryPatternsModal, Object.assign({}, defaultProps)));
        yield userEvent.click(screen.getByText('Log query starters'));
        expect(screen.getByText(queryPatterns.logQueryPatterns[0].name)).toBeInTheDocument();
        yield userEvent.click(screen.getByText('Log query starters'));
        expect(screen.queryByText(queryPatterns.logQueryPatterns[0].name)).not.toBeInTheDocument();
    }));
    it('can open and close multiple query patterns section', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(QueryPatternsModal, Object.assign({}, defaultProps)));
        yield userEvent.click(screen.getByText('Log query starters'));
        expect(screen.getByText(queryPatterns.logQueryPatterns[0].name)).toBeInTheDocument();
        yield userEvent.click(screen.getByText('Metric query starters'));
        expect(screen.getByText(queryPatterns.metricQueryPatterns[0].name)).toBeInTheDocument();
        yield userEvent.click(screen.getByText('Log query starters'));
        expect(screen.queryByText(queryPatterns.logQueryPatterns[0].name)).not.toBeInTheDocument();
        // Metric patterns should still be open
        expect(screen.getByText(queryPatterns.metricQueryPatterns[0].name)).toBeInTheDocument();
    }));
    it('uses pattern if there is no existing query', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(QueryPatternsModal, Object.assign({}, defaultProps, { query: { expr: '{job="grafana"}', refId: 'A' } })));
        yield userEvent.click(screen.getByText('Log query starters'));
        expect(screen.getByText(queryPatterns.logQueryPatterns[0].name)).toBeInTheDocument();
        const firstUseQueryButton = screen.getAllByRole('button', { name: 'Use this query' })[0];
        yield userEvent.click(firstUseQueryButton);
        yield waitFor(() => {
            expect(defaultProps.onChange).toHaveBeenCalledWith({
                expr: '{job="grafana"} | logfmt | __error__=``',
                refId: 'A',
            });
        });
    }));
    it('gives warning when selecting pattern if there is already existing query', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(QueryPatternsModal, Object.assign({}, defaultProps)));
        yield userEvent.click(screen.getByText('Log query starters'));
        expect(screen.getByText(queryPatterns.logQueryPatterns[0].name)).toBeInTheDocument();
        const firstUseQueryButton = screen.getAllByRole('button', { name: 'Use this query' })[0];
        yield userEvent.click(firstUseQueryButton);
        expect(screen.getByText(/replace your current query or create a new query/)).toBeInTheDocument();
    }));
    it('can use create new query when selecting pattern if there is already existing query', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(QueryPatternsModal, Object.assign({}, defaultProps)));
        yield userEvent.click(screen.getByText('Log query starters'));
        expect(screen.getByText(queryPatterns.logQueryPatterns[0].name)).toBeInTheDocument();
        const firstUseQueryButton = screen.getAllByRole('button', { name: 'Use this query' })[0];
        yield userEvent.click(firstUseQueryButton);
        const createNewQueryButton = screen.getByRole('button', { name: 'Create new query' });
        expect(createNewQueryButton).toBeInTheDocument();
        yield userEvent.click(createNewQueryButton);
        yield waitFor(() => {
            expect(defaultProps.onAddQuery).toHaveBeenCalledWith({
                expr: '{} | logfmt | __error__=``',
                refId: 'B',
            });
        });
    }));
    it('does not show create new query option if onAddQuery function is not provided ', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(QueryPatternsModal, Object.assign({}, defaultProps, { onAddQuery: undefined })));
        yield userEvent.click(screen.getByText('Log query starters'));
        expect(screen.getByText(queryPatterns.logQueryPatterns[0].name)).toBeInTheDocument();
        const useQueryButton = screen.getAllByRole('button', { name: 'Use this query' })[0];
        yield userEvent.click(useQueryButton);
        expect(screen.queryByRole('button', { name: 'Create new query' })).not.toBeInTheDocument();
        expect(screen.getByText(/your current query will be replaced/)).toBeInTheDocument();
    }));
});
//# sourceMappingURL=QueryPatternsModal.test.js.map