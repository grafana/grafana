import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

    expect(screen.getAllByLabelText('Drag and drop to reorder').length).toEqual(2);
  });

  it('does not render draggable icon', () => {
    renderScenario({ excludeBaseLayer: true });

    expect(screen.queryAllByLabelText('Drag and drop to reorder').length).toEqual(0);
  });

  it('calls onDelete when delete button is clicked', async () => {
    const user = userEvent.setup();
    const { props } = renderScenario({ showActions: () => true });

    const deleteButtons = screen.getAllByLabelText('Remove');
    await user.click(deleteButtons[0]);

    expect(props.onDelete).toHaveBeenCalledTimes(1);
    expect(props.onDelete).toHaveBeenCalledWith({ name: layerTwoName, getName: expect.any(Function) });
  });

  it('calls onDuplicate when duplicate button is clicked', async () => {
    const user = userEvent.setup();
    const { props } = renderScenario({ showActions: () => true });

    const duplicateButtons = screen.getAllByLabelText('Duplicate');
    await user.click(duplicateButtons[0]);

    expect(props.onDuplicate).toHaveBeenCalledTimes(1);
    expect(props.onDuplicate).toHaveBeenCalledWith({ name: layerTwoName, getName: expect.any(Function) });
  });

  it('calls onSelect when layer row is clicked', async () => {
    const user = userEvent.setup();
    const { props } = renderScenario({});

    const layerRows = screen.getAllByRole('button');
    await user.click(layerRows[0]);

    expect(props.onSelect).toHaveBeenCalledTimes(1);
    expect(props.onSelect).toHaveBeenCalledWith({ name: layerTwoName, getName: expect.any(Function) });
  });

  it('calls onSelect when Enter key is pressed on layer row', () => {
    const { props } = renderScenario({});

    const layerRows = screen.getAllByRole('button');
    fireEvent.keyDown(layerRows[0], { key: 'Enter' });

    expect(props.onSelect).toHaveBeenCalledTimes(1);
    expect(props.onSelect).toHaveBeenCalledWith({ name: layerTwoName, getName: expect.any(Function) });
  });

  it('calls onSelect when Space key is pressed on layer row', () => {
    const { props } = renderScenario({});

    const layerRows = screen.getAllByRole('button');
    fireEvent.keyDown(layerRows[0], { key: ' ' });

    expect(props.onSelect).toHaveBeenCalledTimes(1);
    expect(props.onSelect).toHaveBeenCalledWith({ name: layerTwoName, getName: expect.any(Function) });
  });

  it('does not call onSelect when other keys are pressed on layer row', () => {
    const { props } = renderScenario({});

    const layerRows = screen.getAllByRole('button');
    fireEvent.keyDown(layerRows[0], { key: 'Tab' });
    fireEvent.keyDown(layerRows[0], { key: 'Escape' });

    expect(props.onSelect).not.toHaveBeenCalled();
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
