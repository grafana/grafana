import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { ApiKeysPage } from './ApiKeysPage';
import { getMultipleMockKeys, getMockKey } from './__mocks__/apiKeysMock';
var setup = function (propOverrides) {
    var props = {
        navModel: {
            main: {
                text: 'Configuration',
            },
            node: {
                text: 'Api Keys',
            },
        },
        apiKeys: [],
        searchQuery: '',
        hasFetched: false,
        loadApiKeys: jest.fn(),
        deleteApiKey: jest.fn(),
        setSearchQuery: jest.fn(),
        addApiKey: jest.fn(),
        apiKeysCount: 0,
    };
    Object.assign(props, propOverrides);
    var wrapper = shallow(React.createElement(ApiKeysPage, tslib_1.__assign({}, props)));
    var instance = wrapper.instance();
    return {
        wrapper: wrapper,
        instance: instance,
    };
};
describe('Render', function () {
    it('should render API keys table if there are any keys', function () {
        var wrapper = setup({
            apiKeys: getMultipleMockKeys(5),
            apiKeysCount: 5,
        }).wrapper;
        expect(wrapper).toMatchSnapshot();
    });
    it('should render CTA if there are no API keys', function () {
        var wrapper = setup({
            apiKeys: getMultipleMockKeys(0),
            apiKeysCount: 0,
            hasFetched: true,
        }).wrapper;
        expect(wrapper).toMatchSnapshot();
    });
});
describe('Life cycle', function () {
    it('should call loadApiKeys', function () {
        var instance = setup().instance;
        instance.componentDidMount();
        expect(instance.props.loadApiKeys).toHaveBeenCalled();
    });
});
describe('Functions', function () {
    describe('Delete team', function () {
        it('should call delete team', function () {
            var instance = setup().instance;
            instance.onDeleteApiKey(getMockKey());
            expect(instance.props.deleteApiKey).toHaveBeenCalledWith(1);
        });
    });
    describe('on search query change', function () {
        it('should call setSearchQuery', function () {
            var instance = setup().instance;
            instance.onSearchQueryChange('test');
            expect(instance.props.setSearchQuery).toHaveBeenCalledWith('test');
        });
    });
});
//# sourceMappingURL=ApiKeysPage.test.js.map