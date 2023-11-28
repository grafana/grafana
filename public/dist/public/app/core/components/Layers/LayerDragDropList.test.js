import { render, screen } from '@testing-library/react';
import React from 'react';
import { DATA_TEST_ID, LayerDragDropList } from './LayerDragDropList';
describe('LayerDragDropList', () => {
    const layerOneName = 'rocket12345';
    const layerTwoName = 'man6789';
    it('renders LayerDragDropList', () => {
        renderScenario({});
        screen.getByTestId(DATA_TEST_ID);
        screen.getByText(layerOneName);
        screen.getByText(layerTwoName);
    });
    it('excludeBaseLayer', () => {
        renderScenario({ excludeBaseLayer: true });
        screen.getByText(layerTwoName);
        expect(screen.queryByTestId(layerOneName)).not.toBeInTheDocument();
    });
    it('showActions', () => {
        renderScenario({ showActions: () => true });
        expect(screen.getAllByLabelText('Duplicate').length).toEqual(2);
        expect(screen.getAllByLabelText('Remove').length).toEqual(2);
    });
    it('showActions - no duplicate', () => {
        renderScenario({ showActions: () => true, onDuplicate: undefined });
        expect(screen.getAllByLabelText('Remove').length).toEqual(2);
        expect(screen.queryAllByLabelText('Duplicate').length).toEqual(0);
    });
    it('renders draggable icon', () => {
        renderScenario({});
        expect(screen.getAllByLabelText('Drag and drop icon').length).toEqual(2);
    });
    it('does not render draggable icon', () => {
        renderScenario({ excludeBaseLayer: true });
        expect(screen.queryAllByLabelText('Drag and drop icon').length).toEqual(0);
    });
    function renderScenario(overrides) {
        const testLayers = [
            { name: layerOneName, getName: () => layerOneName },
            { name: layerTwoName, getName: () => layerTwoName },
        ];
        const props = {
            layers: testLayers,
            getLayerInfo: jest.fn(),
            onDragEnd: jest.fn(),
            onSelect: jest.fn(),
            onDelete: jest.fn(),
            onDuplicate: jest.fn(),
            showActions: jest.fn(),
            selection: [],
            excludeBaseLayer: false,
            onNameChange: jest.fn(),
            verifyLayerNameUniqueness: undefined,
        };
        Object.assign(props, overrides);
        return {
            props,
            renderResult: render(React.createElement(LayerDragDropList, Object.assign({}, props))),
        };
    }
});
//# sourceMappingURL=LayerDragDropList.test.js.map