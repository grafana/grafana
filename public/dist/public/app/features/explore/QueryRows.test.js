import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { configureStore } from 'app/store/configureStore';
import { Provider } from 'react-redux';
import { QueryRows } from './QueryRows';
import { ExploreId } from 'app/types';
import { makeExplorePaneState } from './state/utils';
import { setDataSourceSrv } from '@grafana/runtime';
function setup(queries) {
    var defaultDs = {
        name: 'newDs',
        uid: 'newDs-uid',
        meta: { id: 'newDs' },
    };
    var datasources = {
        'newDs-uid': defaultDs,
        'someDs-uid': {
            name: 'someDs',
            uid: 'someDs-uid',
            meta: { id: 'someDs' },
            components: {
                QueryEditor: function () { return 'someDs query editor'; },
            },
        },
    };
    setDataSourceSrv({
        getList: function () {
            return Object.values(datasources).map(function (d) { return ({ name: d.name }); });
        },
        getInstanceSettings: function (uid) {
            return datasources[uid] || defaultDs;
        },
        get: function (uid) {
            return Promise.resolve(uid ? datasources[uid] || defaultDs : defaultDs);
        },
    });
    var leftState = makeExplorePaneState();
    var initialState = {
        left: __assign(__assign({}, leftState), { datasourceInstance: datasources['someDs-uid'], queries: queries }),
        syncedTimes: false,
        right: undefined,
        richHistory: [],
        localStorageFull: false,
        richHistoryLimitExceededWarningShown: false,
    };
    var store = configureStore({ explore: initialState, user: { orgId: 1 } });
    return {
        store: store,
        datasources: datasources,
    };
}
describe('Explore QueryRows', function () {
    it('Should duplicate a query and generate a valid refId', function () { return __awaiter(void 0, void 0, void 0, function () {
        var store, duplicateButton, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    store = setup([{ refId: 'A' }]).store;
                    render(React.createElement(Provider, { store: store },
                        React.createElement(QueryRows, { exploreId: ExploreId.left })));
                    // waiting for the d&d component to fully render.
                    return [4 /*yield*/, screen.findAllByText('someDs query editor')];
                case 1:
                    // waiting for the d&d component to fully render.
                    _b.sent();
                    duplicateButton = screen.getByTitle('Duplicate query');
                    fireEvent.click(duplicateButton);
                    // We should have another row with refId B
                    _a = expect;
                    return [4 /*yield*/, screen.findByLabelText('Query editor row title B')];
                case 2:
                    // We should have another row with refId B
                    _a.apply(void 0, [_b.sent()]).toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=QueryRows.test.js.map