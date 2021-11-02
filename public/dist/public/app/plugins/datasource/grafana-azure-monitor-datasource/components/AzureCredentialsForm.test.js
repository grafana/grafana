import { __assign } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import AzureCredentialsForm from './AzureCredentialsForm';
import { LegacyForms, Button } from '@grafana/ui';
var Input = LegacyForms.Input, Select = LegacyForms.Select;
var setup = function (propsFunc) {
    var props = {
        managedIdentityEnabled: false,
        credentials: {
            authType: 'clientsecret',
            azureCloud: 'azuremonitor',
            tenantId: 'e7f3f661-a933-3h3f-0294-31c4f962ec48',
            clientId: '34509fad-c0r9-45df-9e25-f1ee34af6900',
            clientSecret: undefined,
            defaultSubscriptionId: '44987801-6nn6-49he-9b2d-9106972f9789',
        },
        azureCloudOptions: [
            { value: 'azuremonitor', label: 'Azure' },
            { value: 'govazuremonitor', label: 'Azure US Government' },
            { value: 'germanyazuremonitor', label: 'Azure Germany' },
            { value: 'chinaazuremonitor', label: 'Azure China' },
        ],
        onCredentialsChange: jest.fn(),
        getSubscriptions: jest.fn(),
    };
    if (propsFunc) {
        props = propsFunc(props);
    }
    return shallow(React.createElement(AzureCredentialsForm, __assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
    it('should disable azure monitor secret input', function () {
        var wrapper = setup(function (props) { return (__assign(__assign({}, props), { credentials: {
                authType: 'clientsecret',
                azureCloud: 'azuremonitor',
                tenantId: 'e7f3f661-a933-3h3f-0294-31c4f962ec48',
                clientId: '34509fad-c0r9-45df-9e25-f1ee34af6900',
                clientSecret: Symbol(),
            } })); });
        expect(wrapper).toMatchSnapshot();
    });
    it('should enable azure monitor load subscriptions button', function () {
        var wrapper = setup(function (props) { return (__assign(__assign({}, props), { credentials: {
                authType: 'clientsecret',
                azureCloud: 'azuremonitor',
                tenantId: 'e7f3f661-a933-3h3f-0294-31c4f962ec48',
                clientId: '34509fad-c0r9-45df-9e25-f1ee34af6900',
                clientSecret: 'e7f3f661-a933-4b3f-8176-51c4f982ec48',
            } })); });
        expect(wrapper).toMatchSnapshot();
    });
    describe('when disabled', function () {
        it('should disable inputs', function () {
            var wrapper = setup(function (props) { return (__assign(__assign({}, props), { disabled: true })); });
            var inputs = wrapper.find(Input);
            expect(inputs.length).toBeGreaterThan(1);
            inputs.forEach(function (input) {
                expect(input.prop('disabled')).toBe(true);
            });
        });
        it('should remove buttons', function () {
            var wrapper = setup(function (props) { return (__assign(__assign({}, props), { disabled: true })); });
            expect(wrapper.find(Button).exists()).toBe(false);
        });
        it('should disable cloud selector', function () {
            var wrapper = setup(function (props) { return (__assign(__assign({}, props), { disabled: true })); });
            var selects = wrapper.find(Select);
            selects.forEach(function (s) { return expect(s.prop('isDisabled')).toBe(true); });
        });
        it('should render a children component', function () {
            var wrapper = setup(function (props) { return (__assign(__assign({}, props), { children: React.createElement("button", null, "click me") })); });
            var button = wrapper.find('button');
            expect(button.text()).toBe('click me');
        });
    });
});
//# sourceMappingURL=AzureCredentialsForm.test.js.map