import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { createRef } from 'react';
import { Provider } from 'react-redux';
import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import { configureStore } from '../../../store/configureStore';
import { frameOld } from './TraceView.test';
import { TraceViewContainer } from './TraceViewContainer';
jest.mock('@grafana/runtime', () => {
    return Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { reportInteraction: jest.fn() });
});
function renderTraceViewContainer(frames = [frameOld]) {
    const store = configureStore();
    const mockPanelData = {
        state: LoadingState.Done,
        series: [],
        timeRange: getDefaultTimeRange(),
    };
    const topOfViewRef = createRef();
    const { container, baseElement } = render(React.createElement(Provider, { store: store },
        React.createElement(TraceViewContainer, { exploreId: "left", dataFrames: frames, splitOpenFn: () => { }, queryResponse: mockPanelData, topOfViewRef: topOfViewRef })));
    return {
        header: container.children[0],
        timeline: container.children[1],
        container,
        baseElement,
    };
}
describe('TraceViewContainer', () => {
    let user;
    beforeEach(() => {
        jest.useFakeTimers();
        // Need to use delay: null here to work with fakeTimers
        // see https://github.com/testing-library/user-event/issues/833
        user = userEvent.setup({ delay: null });
    });
    afterEach(() => {
        jest.useRealTimers();
    });
    it('toggles children visibility', () => __awaiter(void 0, void 0, void 0, function* () {
        renderTraceViewContainer();
        expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(3);
        yield user.click(screen.getAllByText('', { selector: 'span[data-testid="SpanTreeOffset--indentGuide"]' })[0]);
        expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(1);
        yield user.click(screen.getAllByText('', { selector: 'span[data-testid="SpanTreeOffset--indentGuide"]' })[0]);
        expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(3);
    }));
    it('toggles collapses and expands one level of spans', () => __awaiter(void 0, void 0, void 0, function* () {
        renderTraceViewContainer();
        expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(3);
        yield user.click(screen.getByLabelText('Collapse +1'));
        expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(2);
        yield user.click(screen.getByLabelText('Expand +1'));
        expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(3);
    }));
    it('toggles collapses and expands all levels', () => __awaiter(void 0, void 0, void 0, function* () {
        renderTraceViewContainer();
        expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(3);
        yield user.click(screen.getByLabelText('Collapse All'));
        expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(1);
        yield user.click(screen.getByLabelText('Expand All'));
        expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(3);
    }));
    it('can select next/prev results', () => __awaiter(void 0, void 0, void 0, function* () {
        renderTraceViewContainer();
        const spanFiltersButton = screen.getByRole('button', { name: 'Span Filters 3 spans Prev Next' });
        yield user.click(spanFiltersButton);
        const nextResultButton = screen.getByRole('button', { name: 'Next result button' });
        const prevResultButton = screen.getByRole('button', { name: 'Prev result button' });
        expect(nextResultButton.getAttribute('tabindex')).toBe('-1');
        expect(prevResultButton.getAttribute('tabindex')).toBe('-1');
        yield user.click(screen.getByLabelText('Select tag key'));
        const tagOption = screen.getByText('component');
        yield waitFor(() => expect(tagOption).toBeInTheDocument());
        yield user.click(tagOption);
        yield waitFor(() => {
            expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[0].parentElement.className).toContain('rowMatchingFilter');
            expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[1].parentElement.className).toContain('rowMatchingFilter');
            expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[2].parentElement.className).toContain('rowMatchingFilter');
        });
        expect(nextResultButton.getAttribute('tabindex')).toBe('0');
        expect(prevResultButton.getAttribute('tabindex')).toBe('0');
        yield user.click(nextResultButton);
        yield waitFor(() => {
            expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[0].parentElement.className).toContain('rowFocused');
        });
        yield user.click(nextResultButton);
        yield waitFor(() => {
            expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[1].parentElement.className).toContain('rowFocused');
        });
        yield user.click(prevResultButton);
        yield waitFor(() => {
            expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' })[0].parentElement.className).toContain('rowFocused');
        });
    }));
    it('show matches only works as expected', () => __awaiter(void 0, void 0, void 0, function* () {
        renderTraceViewContainer();
        const spanFiltersButton = screen.getByRole('button', { name: 'Span Filters 3 spans Prev Next' });
        yield user.click(spanFiltersButton);
        yield user.click(screen.getByLabelText('Select tag key'));
        const tagOption = screen.getByText('http.status_code');
        yield waitFor(() => expect(tagOption).toBeInTheDocument());
        yield user.click(tagOption);
        expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(3);
        const matchesSwitch = screen.getByRole('checkbox', { name: 'Show matches only switch' });
        expect(matchesSwitch).toBeInTheDocument();
        yield user.click(matchesSwitch);
        expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(1);
    }));
});
//# sourceMappingURL=TraceViewContainer.test.js.map