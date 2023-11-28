import { __awaiter } from "tslib";
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { ServiceAccountCreatePage } from './ServiceAccountCreatePage';
const postMock = jest.fn().mockResolvedValue({});
const patchMock = jest.fn().mockResolvedValue({});
const putMock = jest.fn().mockResolvedValue({});
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => ({
        post: postMock,
        patch: patchMock,
        put: putMock,
    }), config: {
        loginError: false,
        buildInfo: {
            version: 'v1.0',
            commit: '1',
            env: 'production',
            edition: 'Open Source',
        },
        licenseInfo: {
            stateInfo: '',
            licenseUrl: '',
        },
        appSubUrl: '',
        featureToggles: {},
    } })));
jest.mock('app/core/core', () => ({
    contextSrv: {
        licensedAccessControlEnabled: () => false,
        hasPermission: () => true,
        hasPermissionInMetadata: () => true,
        user: { orgId: 1 },
    },
}));
const setup = (propOverrides) => {
    const props = {
        navModel: {
            main: {
                text: 'Configuration',
            },
            node: {
                text: 'Service accounts',
            },
        },
    };
    Object.assign(props, propOverrides);
    render(React.createElement(TestProvider, null,
        React.createElement(ServiceAccountCreatePage, Object.assign({}, props))));
};
describe('ServiceAccountCreatePage tests', () => {
    it('Should display service account create page', () => {
        setup({});
        expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
    });
    it('Should fire form validation error if name is not set', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({});
        fireEvent.click(screen.getByRole('button', { name: 'Create' }));
        expect(yield screen.findByText('Display name is required')).toBeInTheDocument();
    }));
    it('Should call API with proper params when creating new service account', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({});
        yield userEvent.type(screen.getByLabelText('Display name *'), 'Data source scavenger');
        fireEvent.click(screen.getByRole('button', { name: 'Create' }));
        yield waitFor(() => expect(postMock).toHaveBeenCalledWith('/api/serviceaccounts/', {
            name: 'Data source scavenger',
            role: 'None',
        }));
    }));
});
//# sourceMappingURL=ServiceAccountCreatePage.test.js.map