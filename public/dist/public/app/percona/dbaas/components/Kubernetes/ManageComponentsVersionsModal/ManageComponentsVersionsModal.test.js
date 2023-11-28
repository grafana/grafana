import { render, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { kubernetesStub } from '../__mocks__/kubernetesStubs';
import { ManageComponentsVersionsModal } from './ManageComponentsVersionsModal';
import { operatorsOptionsStubs, psmdbComponentOptionsStubs, versionsFieldNameStub, versionsStubs, } from './__mocks__/componentsVersionsStubs';
jest.mock('app/core/app_events');
jest.mock('./ManageComponentsVersions.hooks');
describe('ManageComponentsVersionsModal::', () => {
    it('renders form with operator, component and versions field with correct values', () => {
        var _a, _b;
        render(React.createElement(ManageComponentsVersionsModal, { setSelectedCluster: () => { }, isVisible: true, selectedKubernetes: kubernetesStub[0], setVisible: jest.fn() }));
        expect((_a = screen.getByTestId('kubernetes-operator').textContent) === null || _a === void 0 ? void 0 : _a.includes(operatorsOptionsStubs[0].label)).toBeTruthy();
        expect((_b = screen.getByTestId('kubernetes-component').textContent) === null || _b === void 0 ? void 0 : _b.includes(psmdbComponentOptionsStubs[0].label)).toBeTruthy();
        expect(screen.getByTestId(`${versionsFieldNameStub}-options`).children).toHaveLength(versionsStubs.length);
        expect(screen.getByTestId('kubernetes-default-version')).toBeInTheDocument();
    });
    it('calls setVisible on cancel', () => {
        const setVisible = jest.fn();
        render(React.createElement(ManageComponentsVersionsModal, { setSelectedCluster: () => { }, isVisible: true, selectedKubernetes: kubernetesStub[0], setVisible: setVisible }));
        const btn = screen.getByTestId('kubernetes-components-versions-cancel');
        fireEvent.click(btn);
        expect(setVisible).toHaveBeenCalledWith(false);
    });
});
//# sourceMappingURL=ManageComponentsVersionsModal.test.js.map