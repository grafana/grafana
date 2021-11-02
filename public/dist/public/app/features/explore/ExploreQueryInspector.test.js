import { __assign } from "tslib";
import React from 'react';
import { Observable } from 'rxjs';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoadingState } from '@grafana/data';
import { ExploreId } from 'app/types';
import { ExploreQueryInspector } from './ExploreQueryInspector';
jest.mock('../inspector/styles', function () { return ({
    getPanelInspectorStyles: function () { return ({}); },
}); });
jest.mock('app/core/services/backend_srv', function () { return ({
    backendSrv: {
        getInspectorStream: function () {
            return new Observable(function (subscriber) {
                subscriber.next(response());
                subscriber.next(response(true));
            });
        },
    },
}); });
jest.mock('app/core/services/context_srv', function () { return ({
    contextSrv: {
        user: { orgId: 1 },
    },
}); });
var setup = function (propOverrides) {
    if (propOverrides === void 0) { propOverrides = {}; }
    var props = __assign({ loading: false, width: 100, exploreId: ExploreId.left, onClose: jest.fn(), queryResponse: {
            state: LoadingState.Done,
            series: [],
            timeRange: {},
        }, runQueries: jest.fn() }, propOverrides);
    return render(React.createElement(ExploreQueryInspector, __assign({}, props)));
};
describe('ExploreQueryInspector', function () {
    it('should render closable drawer component', function () {
        setup();
        expect(screen.getByTitle(/close query inspector/i)).toBeInTheDocument();
    });
    it('should render 4 Tabs if queryResponse has no error', function () {
        setup();
        expect(screen.getAllByLabelText(/tab/i)).toHaveLength(4);
    });
    it('should render 5 Tabs if queryResponse has error', function () {
        setup({ queryResponse: { error: 'Bad gateway' } });
        expect(screen.getAllByLabelText(/tab/i)).toHaveLength(5);
    });
    it('should display query data when click on expanding', function () {
        setup();
        fireEvent.click(screen.getByLabelText(/tab query/i));
        fireEvent.click(screen.getByText(/expand all/i));
        expect(screen.getByText(/very unique test value/i)).toBeInTheDocument();
    });
});
var response = function (hideFromInspector) {
    if (hideFromInspector === void 0) { hideFromInspector = false; }
    return ({
        status: 1,
        statusText: '',
        ok: true,
        headers: {},
        redirected: false,
        type: 'basic',
        url: '',
        request: {},
        data: {
            test: {
                testKey: 'Very unique test value',
            },
        },
        config: {
            url: '',
            hideFromInspector: hideFromInspector,
        },
    });
};
//# sourceMappingURL=ExploreQueryInspector.test.js.map