import { __assign } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import ConfigEditor from './ConfigEditor';
var setup = function (propOverrides) {
    var props = {
        options: {
            id: 21,
            uid: 'z',
            orgId: 1,
            name: 'InfluxDB-3',
            type: 'influxdb',
            typeName: 'Influx',
            typeLogoUrl: '',
            access: 'proxy',
            url: '',
            password: '',
            user: '',
            database: '',
            basicAuth: false,
            basicAuthUser: '',
            basicAuthPassword: '',
            withCredentials: false,
            isDefault: false,
            jsonData: {
                httpMode: 'POST',
                timeInterval: '4',
            },
            secureJsonFields: {},
            version: 1,
            readOnly: false,
        },
        onOptionsChange: jest.fn(),
    };
    Object.assign(props, propOverrides);
    return shallow(React.createElement(ConfigEditor, __assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
    it('should disable basic auth password input', function () {
        var wrapper = setup({
            secureJsonFields: {
                basicAuthPassword: true,
            },
        });
        expect(wrapper).toMatchSnapshot();
    });
    it('should hide white listed cookies input when browser access chosen', function () {
        var wrapper = setup({
            access: 'direct',
        });
        expect(wrapper).toMatchSnapshot();
    });
    it('should hide basic auth fields when switch off', function () {
        var wrapper = setup({
            basicAuth: false,
        });
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=ConfigEditor.test.js.map