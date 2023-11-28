import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { LayerName } from './LayerName';
describe('LayerName', () => {
    it('Can edit title', () => __awaiter(void 0, void 0, void 0, function* () {
        const scenario = renderScenario({});
        yield userEvent.click(screen.getByTestId('layer-name-div'));
        const input = screen.getByTestId('layer-name-input');
        yield userEvent.clear(input);
        yield userEvent.type(input, 'new name');
        // blur the element
        yield userEvent.click(document.body);
        expect(jest.mocked(scenario.props.onChange).mock.calls[0][0]).toBe('new name');
    }));
    it('Show error when empty name is specified', () => __awaiter(void 0, void 0, void 0, function* () {
        renderScenario({});
        yield userEvent.click(screen.getByTestId('layer-name-div'));
        const input = screen.getByTestId('layer-name-input');
        yield userEvent.clear(input);
        const alert = yield screen.findByRole('alert');
        expect(alert.textContent).toBe('An empty layer name is not allowed');
    }));
    it('Show error when other layer with same name exists', () => __awaiter(void 0, void 0, void 0, function* () {
        renderScenario({});
        yield userEvent.click(screen.getByTestId('layer-name-div'));
        const input = screen.getByTestId('layer-name-input');
        yield userEvent.clear(input);
        yield userEvent.type(input, 'Layer 2');
        const alert = yield screen.findByRole('alert');
        expect(alert.textContent).toBe('Layer name already exists');
    }));
    function renderScenario(overrides) {
        const props = {
            name: 'Layer 1',
            onChange: jest.fn(),
            verifyLayerNameUniqueness: (nameToCheck) => {
                const names = new Set(['Layer 1', 'Layer 2']);
                return !names.has(nameToCheck);
            },
        };
        Object.assign(props, overrides);
        return {
            props,
            renderResult: render(React.createElement(LayerName, Object.assign({}, props))),
        };
    }
});
//# sourceMappingURL=LayerName.test.js.map