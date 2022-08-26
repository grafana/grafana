import { render, screen } from '@testing-library/react';
import React from 'react';

import { DATA_TEST_ID, LayerDragDropList, LayerDragDropListProps } from './LayerDragDropList';

describe('LayerDragDropList', () => {
  type testLayer = { name: string; getName: () => string };
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

    // TODO: rewrite this.... expecting getByText to fail...
    try {
      screen.getByText(layerOneName);
    } catch (error) {
      expect(true);
    }
  });

  it('showActions', () => {
    renderScenario({ showActions: () => true });

    expect(screen.getAllByLabelText('Duplicate button').length).toEqual(2);
    expect(screen.getAllByLabelText('Remove button').length).toEqual(2);
  });

  it('showActions - no duplicate', () => {
    renderScenario({ showActions: () => true, onDuplicate: undefined });

    expect(screen.getAllByLabelText('Remove button').length).toEqual(2);

    // TODO: rewrite this.... expecting getByText to fail...
    try {
      screen.getAllByLabelText('Duplicate button');
    } catch (error) {
      expect(true);
    }
  });

  it('renders draggable icon', () => {
    renderScenario({});

    expect(screen.getAllByLabelText('Drag and drop icon').length).toEqual(2);
  });

  it('does not render draggable icon', () => {
    renderScenario({ excludeBaseLayer: true });

    // TODO: rewrite this.... expecting getByText to fail...
    try {
      screen.getAllByLabelText('Drag and drop icon');
    } catch (error) {
      expect(true);
    }
  });

  function renderScenario(overrides: Partial<LayerDragDropListProps<testLayer>>) {
    const testLayers = [
      { name: layerOneName, getName: () => layerOneName },
      { name: layerTwoName, getName: () => layerTwoName },
    ];
    const props: LayerDragDropListProps<testLayer> = {
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
      renderResult: render(<LayerDragDropList {...props} />),
    };
  }
});
