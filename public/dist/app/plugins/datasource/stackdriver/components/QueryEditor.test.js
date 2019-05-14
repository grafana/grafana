import * as tslib_1 from "tslib";
import React from 'react';
import renderer from 'react-test-renderer';
import { QueryEditor, DefaultTarget } from './QueryEditor';
import { TemplateSrv } from 'app/features/templating/template_srv';
var props = {
    onQueryChange: function (target) { },
    onExecuteQuery: function () { },
    target: DefaultTarget,
    events: { on: function () { } },
    datasource: {
        getDefaultProject: function () { return Promise.resolve('project'); },
        getMetricTypes: function () { return Promise.resolve([]); },
    },
    templateSrv: new TemplateSrv(),
};
describe('QueryEditor', function () {
    it('renders correctly', function () {
        var tree = renderer.create(React.createElement(QueryEditor, tslib_1.__assign({}, props))).toJSON();
        expect(tree).toMatchSnapshot();
    });
});
//# sourceMappingURL=QueryEditor.test.js.map