import { __awaiter, __generator } from "tslib";
import React from 'react';
import { configureStore } from '../../store/configureStore';
import { ResponseErrorContainer } from './ResponseErrorContainer';
import { Provider } from 'react-redux';
import { render, screen } from '@testing-library/react';
import { ExploreId } from '../../types';
import { LoadingState } from '@grafana/data';
describe('ResponseErrorContainer', function () {
    it('shows error message if it does not contain refId', function () { return __awaiter(void 0, void 0, void 0, function () {
        var errorMessage, errorEl;
        return __generator(this, function (_a) {
            errorMessage = 'test error';
            setup({
                message: errorMessage,
            });
            errorEl = screen.getByLabelText('Alert error');
            expect(errorEl).toBeInTheDocument();
            expect(errorEl).toHaveTextContent(errorMessage);
            return [2 /*return*/];
        });
    }); });
    it('shows error if there is refID', function () { return __awaiter(void 0, void 0, void 0, function () {
        var errorMessage, errorEl;
        return __generator(this, function (_a) {
            errorMessage = 'test error';
            setup({
                refId: 'someId',
                message: errorMessage,
            });
            errorEl = screen.getByLabelText('Alert error');
            expect(errorEl).toBeInTheDocument();
            expect(errorEl).toHaveTextContent(errorMessage);
            return [2 /*return*/];
        });
    }); });
    it('shows error.data.message if error.message does not exist', function () { return __awaiter(void 0, void 0, void 0, function () {
        var errorMessage, errorEl;
        return __generator(this, function (_a) {
            errorMessage = 'test error';
            setup({
                data: {
                    message: 'test error',
                },
            });
            errorEl = screen.getByLabelText('Alert error');
            expect(errorEl).toBeInTheDocument();
            expect(errorEl).toHaveTextContent(errorMessage);
            return [2 /*return*/];
        });
    }); });
});
function setup(error) {
    var store = configureStore();
    store.getState().explore[ExploreId.left].queryResponse = {
        timeRange: {},
        series: [],
        state: LoadingState.Error,
        error: error,
    };
    render(React.createElement(Provider, { store: store },
        React.createElement(ResponseErrorContainer, { exploreId: ExploreId.left })));
}
//# sourceMappingURL=ResponseErrorContainer.test.js.map