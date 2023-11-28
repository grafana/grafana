import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from 'app/store/configureStore';
import AccessRolesEnabledCheck from './AccessRolesEnabledCheck';
const wrapWithProvider = (element, enableAccessControl = true) => (React.createElement(Provider, { store: configureStore({
        percona: {
            settings: {
                result: {
                    enableAccessControl,
                },
            },
        },
    }) }, element));
describe('AccessRoleEnabledCheck:', () => {
    it('shows component when access roles are enabled', () => {
        render(wrapWithProvider(React.createElement(AccessRolesEnabledCheck, null,
            React.createElement("button", null))));
        expect(screen.queryByRole('button')).toBeInTheDocument();
    });
    it("doesn't show element when access roles are disabled", () => {
        render(wrapWithProvider(React.createElement(AccessRolesEnabledCheck, null,
            React.createElement("button", null)), false));
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
});
//# sourceMappingURL=AccessRolesEnabledCheck.test.js.map