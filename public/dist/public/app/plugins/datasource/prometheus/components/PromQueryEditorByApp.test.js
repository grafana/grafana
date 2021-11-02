import React from 'react';
import { render } from '@testing-library/react';
import { PromQueryEditorByApp } from './PromQueryEditorByApp';
import { CoreApp } from '@grafana/data';
import { noop } from 'lodash';
import { testIds as alertingTestIds } from './PromQueryEditorForAlerting';
import { testIds as regularTestIds } from './PromQueryEditor';
function setup(app) {
    var dataSource = {
        createQuery: jest.fn(function (q) { return q; }),
        getInitHints: function () { return []; },
        getPrometheusTime: jest.fn(function (date, roundup) { return 123; }),
        languageProvider: {
            start: function () { return Promise.resolve([]); },
            syntax: function () { },
            getLabelKeys: function () { return []; },
            metrics: [],
        },
    };
    return render(React.createElement(PromQueryEditorByApp, { app: app, onChange: noop, onRunQuery: noop, datasource: dataSource, query: { refId: 'A', expr: '' } }));
}
describe('PromQueryEditorByApp', function () {
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
//# sourceMappingURL=PromQueryEditorByApp.test.js.map