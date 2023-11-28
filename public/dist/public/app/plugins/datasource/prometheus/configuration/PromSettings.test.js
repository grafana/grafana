import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '../../../../store/configureStore';
import { getValueFromEventItem, PromSettings } from './PromSettings';
import { createDefaultConfigOptions } from './mocks';
describe('PromSettings', () => {
    describe('getValueFromEventItem', () => {
        describe('when called with undefined', () => {
            it('then it should return empty string', () => {
                const result = getValueFromEventItem(undefined);
                expect(result).toEqual('');
            });
        });
        describe('when called with an input event', () => {
            it('then it should return value from currentTarget', () => {
                const value = 'An input value';
                const result = getValueFromEventItem({ currentTarget: { value } });
                expect(result).toEqual(value);
            });
        });
        describe('when called with a select event', () => {
            it('then it should return value', () => {
                const value = 'A select value';
                const result = getValueFromEventItem({ value });
                expect(result).toEqual(value);
            });
        });
    });
    describe('PromSettings component', () => {
        const defaultProps = createDefaultConfigOptions();
        it('should show POST httpMethod if no httpMethod', () => {
            const options = defaultProps;
            options.url = '';
            options.jsonData.httpMethod = '';
            const store = configureStore();
            render(React.createElement(Provider, { store: store },
                React.createElement(PromSettings, { onOptionsChange: () => { }, options: options })));
            expect(screen.getByText('POST')).toBeInTheDocument();
        });
        it('should show POST httpMethod if POST httpMethod is configured', () => {
            const options = defaultProps;
            options.url = 'test_url';
            options.jsonData.httpMethod = 'POST';
            const store = configureStore();
            render(React.createElement(Provider, { store: store },
                React.createElement(PromSettings, { onOptionsChange: () => { }, options: options })));
            expect(screen.getByText('POST')).toBeInTheDocument();
        });
        it('should show GET httpMethod if GET httpMethod is configured', () => {
            const options = defaultProps;
            options.url = 'test_url';
            options.jsonData.httpMethod = 'GET';
            const store = configureStore();
            render(React.createElement(Provider, { store: store },
                React.createElement(PromSettings, { onOptionsChange: () => { }, options: options })));
            expect(screen.getByText('GET')).toBeInTheDocument();
        });
    });
});
//# sourceMappingURL=PromSettings.test.js.map