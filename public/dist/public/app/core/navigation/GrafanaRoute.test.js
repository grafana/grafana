import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { setEchoSrv } from '@grafana/runtime';
import { Echo } from '../services/echo/Echo';
import { GrafanaRoute } from './GrafanaRoute';
function setup(overrides) {
    const props = Object.assign({ location: { search: '?query=hello&test=asd' }, history: {}, match: {}, route: {
            path: '/',
            component: () => React.createElement("div", null),
        } }, overrides);
    render(React.createElement(TestProvider, null,
        React.createElement(GrafanaRoute, Object.assign({}, props))));
}
describe('GrafanaRoute', () => {
    beforeEach(() => {
        setEchoSrv(new Echo());
    });
    it('Parses search', () => {
        let capturedProps;
        const PageComponent = (props) => {
            capturedProps = props;
            return React.createElement("div", null);
        };
        setup({ route: { component: PageComponent, path: '' } });
        expect(capturedProps.queryParams.query).toBe('hello');
    });
    it('Shows loading on lazy load', () => __awaiter(void 0, void 0, void 0, function* () {
        const PageComponent = React.lazy(() => {
            return new Promise(() => { });
        });
        setup({ route: { component: PageComponent, path: '' } });
        expect(yield screen.findByText('Loading...')).toBeInTheDocument();
    }));
    it('Shows error on page error', () => __awaiter(void 0, void 0, void 0, function* () {
        const PageComponent = () => {
            throw new Error('Page threw error');
        };
        const consoleError = jest.fn();
        jest.spyOn(console, 'error').mockImplementation(consoleError);
        setup({ route: { component: PageComponent, path: '' } });
        expect(yield screen.findByRole('heading', { name: 'An unexpected error happened' })).toBeInTheDocument();
        expect(consoleError).toHaveBeenCalled();
    }));
});
//# sourceMappingURL=GrafanaRoute.test.js.map