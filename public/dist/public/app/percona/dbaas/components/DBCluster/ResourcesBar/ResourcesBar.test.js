import { render, screen } from '@testing-library/react';
import React from 'react';
import { ResourcesUnits } from '../DBCluster.types';
import { ResourcesBar } from './ResourcesBar';
import { Messages } from './ResourcesBar.messages';
describe('ResourcesBar::', () => {
    it('renders correctly with icon, allocated, expected and label', () => {
        const allocated = { value: 2, units: ResourcesUnits.GB, original: 2 };
        const total = { value: 10, units: ResourcesUnits.GB, original: 10 };
        const expected = { value: 2, units: ResourcesUnits.GB, original: 2 };
        const resourceLabel = 'Memory';
        render(React.createElement(ResourcesBar, { icon: React.createElement("div", null, "Test icon"), allocated: allocated, expected: expected, total: total, resourceLabel: resourceLabel }));
        expect(screen.getByTestId('resources-bar-icon')).toHaveTextContent('Test icon');
        expect(screen.getByTestId('resources-bar-label')).toHaveTextContent(Messages.buildResourcesLabel(allocated, 20, total));
        expect(screen.getByTestId('resources-bar-allocated-caption')).toHaveTextContent(Messages.buildAllocatedLabel(resourceLabel));
        expect(screen.getByTestId('resources-bar-expected-caption')).toHaveTextContent(Messages.buildExpectedLabel(expected, resourceLabel));
    });
    it('renders invalid message for insufficient resources', () => {
        const allocated = { value: 2, units: ResourcesUnits.GB, original: 2 };
        const total = { value: 10, units: ResourcesUnits.GB, original: 10 };
        const expected = { value: 20, units: ResourcesUnits.GB, original: 20 };
        const resourceLabel = 'Memory';
        render(React.createElement(ResourcesBar, { allocated: allocated, expected: expected, total: total, resourceLabel: resourceLabel }));
        expect(screen.getByTestId('resources-bar-insufficient-resources')).toHaveTextContent(Messages.buildInsufficientLabel(expected, resourceLabel));
    });
    it('renders correctly when expected value is negative', () => {
        const allocated = { value: 4, units: ResourcesUnits.GB, original: 4 };
        const total = { value: 10, units: ResourcesUnits.GB, original: 10 };
        const expected = { value: -2, units: ResourcesUnits.GB, original: -2 };
        render(React.createElement(ResourcesBar, { icon: React.createElement("div", null, "Test icon"), allocated: allocated, expected: expected, total: total, resourceLabel: "Test label" }));
        const resourcesBar = screen.getByTestId('resources-bar');
        expect(resourcesBar.children).toHaveLength(1);
        expect(resourcesBar.children[0].children).toHaveLength(1);
    });
});
//# sourceMappingURL=ResourcesBar.test.js.map