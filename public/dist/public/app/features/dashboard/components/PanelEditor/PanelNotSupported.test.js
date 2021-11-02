import { __assign } from "tslib";
import { locationService } from '@grafana/runtime';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { PanelNotSupported } from './PanelNotSupported';
import { PanelEditorTabId } from './types';
var setupTestContext = function (options) {
    var defaults = { message: '' };
    var props = __assign(__assign({}, defaults), options);
    render(React.createElement(PanelNotSupported, __assign({}, props)));
    return { props: props };
};
describe('PanelNotSupported', function () {
    describe('when component is mounted', function () {
        it('then the supplied message should be shown', function () {
            setupTestContext({ message: 'Expected message' });
            expect(screen.getByRole('heading', { name: /expected message/i })).toBeInTheDocument();
        });
        it('then the back to queries button should exist', function () {
            setupTestContext({ message: 'Expected message' });
            expect(screen.getByRole('button', { name: /go back to queries/i })).toBeInTheDocument();
        });
    });
    describe('when the back to queries button is clicked', function () {
        it('then correct action should be dispatched', function () {
            setupTestContext({});
            userEvent.click(screen.getByRole('button', { name: /go back to queries/i }));
            expect(locationService.getSearchObject().tab).toBe(PanelEditorTabId.Query);
        });
    });
});
//# sourceMappingURL=PanelNotSupported.test.js.map