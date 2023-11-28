import { render, screen } from '@testing-library/react';
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { AddLayerButton } from './AddLayerButton';
describe('AddLayerButton', () => {
    const testLabel = 'Add Layer';
    it('renders AddLayerButton', () => {
        renderScenario({});
        const button = screen.getByLabelText(selectors.components.ValuePicker.button(testLabel));
        expect(button).toBeInTheDocument();
    });
    function renderScenario(overrides) {
        const dummyOptions = [{ description: 'Use markers to render each data point', label: 'Markers', value: 'markers' }];
        const props = {
            onChange: jest.fn(),
            options: dummyOptions,
            label: testLabel,
        };
        Object.assign(props, overrides);
        return {
            props,
            renderResult: render(React.createElement(AddLayerButton, Object.assign({}, props))),
        };
    }
});
//# sourceMappingURL=AddLayerButton.test.js.map