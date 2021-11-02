import { __assign } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { AwsAuthType } from '@grafana/aws-sdk';
import { ConfigEditor } from './ConfigEditor';
jest.mock('app/features/plugins/datasource_srv', function () { return ({
    getDatasourceSrv: function () { return ({
        loadDatasource: jest.fn().mockImplementation(function () {
            return Promise.resolve({
                getRegions: jest.fn().mockReturnValue([
                    {
                        label: 'ap-east-1',
                        value: 'ap-east-1',
                    },
                ]),
            });
        }),
    }); },
}); });
var setup = function (propOverrides) {
    var props = {
        options: {
            id: 1,
            uid: 'z',
            orgId: 1,
            typeLogoUrl: '',
            name: 'CloudWatch',
            access: 'proxy',
            url: '',
            database: '',
            type: 'cloudwatch',
            typeName: 'Cloudwatch',
            user: '',
            password: '',
            basicAuth: false,
            basicAuthPassword: '',
            basicAuthUser: '',
            isDefault: true,
            readOnly: false,
            withCredentials: false,
            secureJsonFields: {
                accessKey: false,
                secretKey: false,
            },
            jsonData: {
                assumeRoleArn: '',
                externalId: '',
                database: '',
                customMetricsNamespaces: '',
                authType: AwsAuthType.Keys,
                defaultRegion: 'us-east-2',
                timeField: '@timestamp',
            },
            secureJsonData: {
                secretKey: '',
                accessKey: '',
            },
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
    it('should disable access key id field', function () {
        var wrapper = setup({
            secureJsonFields: {
                secretKey: true,
            },
        });
        expect(wrapper).toMatchSnapshot();
    });
    it('should show credentials profile name field', function () {
        var wrapper = setup({
            jsonData: {
                authType: 'credentials',
            },
        });
        expect(wrapper).toMatchSnapshot();
    });
    it('should show access key and secret access key fields', function () {
        var wrapper = setup({
            jsonData: {
                authType: 'keys',
            },
        });
        expect(wrapper).toMatchSnapshot();
    });
    it('should show arn role field', function () {
        var wrapper = setup({
            jsonData: {
                authType: 'arn',
            },
        });
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=ConfigEditor.test.js.map