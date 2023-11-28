import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { configureStore } from '../../store/configureStore';
import { ResponseErrorContainer } from './ResponseErrorContainer';
import { createEmptyQueryResponse, makeExplorePaneState } from './state/utils';
describe('ResponseErrorContainer', () => {
    it('shows error message if it does not contain refId', () => __awaiter(void 0, void 0, void 0, function* () {
        const errorMessage = 'test error';
        setup({
            message: errorMessage,
        });
        const errorEl = screen.getByTestId(selectors.components.Alert.alertV2('error'));
        expect(errorEl).toBeInTheDocument();
        expect(errorEl).toHaveTextContent(errorMessage);
    }));
    it('do not show error if there is a refId', () => __awaiter(void 0, void 0, void 0, function* () {
        const errorMessage = 'test error';
        setup({
            refId: 'someId',
            message: errorMessage,
        });
        const errorEl = screen.queryByTestId(selectors.components.Alert.alertV2('error'));
        expect(errorEl).not.toBeInTheDocument();
    }));
    it('shows error.data.message if error.message does not exist', () => __awaiter(void 0, void 0, void 0, function* () {
        const errorMessage = 'test error';
        setup({
            data: {
                message: 'test error',
            },
        });
        const errorEl = screen.getByTestId(selectors.components.Alert.alertV2('error'));
        expect(errorEl).toBeInTheDocument();
        expect(errorEl).toHaveTextContent(errorMessage);
    }));
});
function setup(error) {
    const store = configureStore();
    store.getState().explore.panes = {
        left: Object.assign(Object.assign({}, makeExplorePaneState()), { queryResponse: Object.assign(Object.assign({}, createEmptyQueryResponse()), { state: LoadingState.Error, error }) }),
    };
    render(React.createElement(TestProvider, { store: store },
        React.createElement(ResponseErrorContainer, { exploreId: "left" })));
}
//# sourceMappingURL=ResponseErrorContainer.test.js.map