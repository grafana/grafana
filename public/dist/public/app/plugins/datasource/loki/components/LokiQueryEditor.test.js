import { __assign } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { toUtc } from '@grafana/data';
import { LokiQueryEditor } from './LokiQueryEditor';
var createMockRequestRange = function (from, to) {
    return {
        from: toUtc(from, 'YYYY-MM-DD'),
        to: toUtc(to, 'YYYY-MM-DD'),
    };
};
var setup = function (propOverrides) {
    var datasourceMock = {};
    var datasource = datasourceMock;
    var onRunQuery = jest.fn();
    var onChange = jest.fn();
    var query = {
        expr: '',
        refId: 'A',
        legendFormat: 'My Legend',
    };
    var range = createMockRequestRange('2020-01-01', '2020-01-02');
    var props = {
        datasource: datasource,
        onChange: onChange,
        onRunQuery: onRunQuery,
        query: query,
        range: range,
    };
    Object.assign(props, propOverrides);
    var wrapper = shallow(React.createElement(LokiQueryEditor, __assign({}, props)));
    var instance = wrapper.instance();
    return {
        instance: instance,
        wrapper: wrapper,
    };
};
describe('Render LokiQueryEditor with legend', function () {
    it('should render', function () {
        var wrapper = setup().wrapper;
        expect(wrapper).toMatchSnapshot();
    });
    it('should update timerange', function () {
        var wrapper = setup().wrapper;
        wrapper.setProps({
            range: createMockRequestRange('2019-01-01', '2020-01-02'),
        });
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=LokiQueryEditor.test.js.map