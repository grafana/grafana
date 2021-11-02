import React from 'react';
import { render } from '@testing-library/react';
import { CoreApp } from '@grafana/data';
import { noop } from 'lodash';
import { testIds as alertingTestIds } from './LokiQueryEditorForAlerting';
import { testIds as regularTestIds } from './LokiQueryEditor';
import LokiQueryEditorByApp from './LokiQueryEditorByApp';
function setup(app) {
    var dataSource = {
        languageProvider: {
            start: function () { return Promise.resolve([]); },
            getSyntax: function () { },
            getLabelKeys: function () { return []; },
            metrics: [],
        },
    };
    return render(React.createElement(LokiQueryEditorByApp, { app: app, onChange: noop, onRunQuery: noop, datasource: dataSource, query: { refId: 'A', expr: '' } }));
}
describe('LokiQueryEditorByApp', function () {
    it('should render simplified query editor for cloud alerting', function () {
        var _a = setup(CoreApp.CloudAlerting), getByTestId = _a.getByTestId, queryByTestId = _a.queryByTestId;
        expect(getByTestId(alertingTestIds.editor)).toBeInTheDocument();
        expect(queryByTestId(regularTestIds.editor)).toBeNull();
    });
    it('should render regular query editor for unkown apps', function () {
        var _a = setup(CoreApp.Unknown), getByTestId = _a.getByTestId, queryByTestId = _a.queryByTestId;
        expect(getByTestId(regularTestIds.editor)).toBeInTheDocument();
        expect(queryByTestId(alertingTestIds.editor)).toBeNull();
    });
    it('should render regular query editor for explore', function () {
        var _a = setup(CoreApp.Explore), getByTestId = _a.getByTestId, queryByTestId = _a.queryByTestId;
        expect(getByTestId(regularTestIds.editor)).toBeInTheDocument();
        expect(queryByTestId(alertingTestIds.editor)).toBeNull();
    });
    it('should render regular query editor for dashboard', function () {
        var _a = setup(CoreApp.Dashboard), getByTestId = _a.getByTestId, queryByTestId = _a.queryByTestId;
        expect(getByTestId(regularTestIds.editor)).toBeInTheDocument();
        expect(queryByTestId(alertingTestIds.editor)).toBeNull();
    });
});
//# sourceMappingURL=LokiQueryEditorByApp.test.js.map