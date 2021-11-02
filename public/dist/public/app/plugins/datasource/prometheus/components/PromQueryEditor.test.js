import { __assign } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { dateTime } from '@grafana/data';
import { PromQueryEditor } from './PromQueryEditor';
jest.mock('app/features/dashboard/services/TimeSrv', function () {
    return {
        getTimeSrv: function () { return ({
            timeRange: function () { return ({
                from: dateTime(),
                to: dateTime(),
            }); },
        }); },
    };
});
var setup = function (propOverrides) {
    var datasourceMock = {
        createQuery: jest.fn(function (q) { return q; }),
        getPrometheusTime: jest.fn(function (date, roundup) { return 123; }),
    };
    var datasource = datasourceMock;
    var onRunQuery = jest.fn();
    var onChange = jest.fn();
    var query = { expr: '', refId: 'A' };
    var props = {
        datasource: datasource,
        onChange: onChange,
        onRunQuery: onRunQuery,
        query: query,
    };
    Object.assign(props, propOverrides);
    var wrapper = shallow(React.createElement(PromQueryEditor, __assign({}, props)));
    var instance = wrapper.instance();
    return {
        instance: instance,
        wrapper: wrapper,
    };
};
describe('Render PromQueryEditor with basic options', function () {
    it('should render', function () {
        var wrapper = setup().wrapper;
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=PromQueryEditor.test.js.map