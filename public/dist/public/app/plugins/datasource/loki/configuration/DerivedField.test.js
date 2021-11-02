import React from 'react';
import { shallow } from 'enzyme';
import { DerivedField } from './DerivedField';
import { DataSourcePicker } from '@grafana/runtime';
jest.mock('app/features/plugins/datasource_srv', function () { return ({
    getDatasourceSrv: function () {
        return {
            getExternal: function () {
                return [
                    {
                        id: 1,
                        uid: 'metrics',
                        name: 'metrics_ds',
                        meta: {
                            tracing: false,
                        },
                    },
                    {
                        id: 2,
                        uid: 'tracing',
                        name: 'tracing_ds',
                        meta: {
                            tracing: true,
                        },
                    },
                ];
            },
        };
    },
}); });
describe('DerivedField', function () {
    it('shows internal link if uid is set', function () {
        var value = {
            matcherRegex: '',
            name: '',
            datasourceUid: 'test',
        };
        var wrapper = shallow(React.createElement(DerivedField, { value: value, onChange: function () { }, onDelete: function () { }, suggestions: [] }));
        expect(wrapper.find(DataSourcePicker).length).toBe(1);
    });
    it('shows url link if uid is not set', function () {
        var value = {
            matcherRegex: '',
            name: '',
            url: 'test',
        };
        var wrapper = shallow(React.createElement(DerivedField, { value: value, onChange: function () { }, onDelete: function () { }, suggestions: [] }));
        expect(wrapper.find(DataSourcePicker).length).toBe(0);
    });
    it('shows only tracing datasources for internal link', function () {
        var value = {
            matcherRegex: '',
            name: '',
            datasourceUid: 'test',
        };
        var wrapper = shallow(React.createElement(DerivedField, { value: value, onChange: function () { }, onDelete: function () { }, suggestions: [] }));
        expect(wrapper.find(DataSourcePicker).props().tracing).toEqual(true);
    });
});
//# sourceMappingURL=DerivedField.test.js.map