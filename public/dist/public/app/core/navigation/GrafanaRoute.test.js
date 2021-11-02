import React from 'react';
import { render } from '@testing-library/react';
import { GrafanaRoute } from './GrafanaRoute';
import { setEchoSrv } from '@grafana/runtime';
import { Echo } from '../services/echo/Echo';
describe('GrafanaRoute', function () {
    beforeEach(function () {
        setEchoSrv(new Echo());
    });
    it('Parses search', function () {
        var capturedProps;
        var PageComponent = function (props) {
            capturedProps = props;
            return React.createElement("div", null);
        };
        var location = { search: '?query=hello&test=asd' };
        var history = {};
        var match = {};
        render(React.createElement(GrafanaRoute, { location: location, history: history, match: match, route: { component: PageComponent } }));
        expect(capturedProps.queryParams.query).toBe('hello');
    });
});
//# sourceMappingURL=GrafanaRoute.test.js.map