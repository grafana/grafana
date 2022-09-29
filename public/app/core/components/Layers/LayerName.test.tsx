import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { LayerNameProps, LayerName } from './LayerName';

describe('LayerName', () => {
  it('Can edit title', () => {
    const scenario = renderScenario({});
    screen.getByTestId('layer-name-div').click();

    const input = screen.getByTestId('layer-name-input');
    fireEvent.change(input, { target: { value: 'new name' } });
    fireEvent.blur(input);

    expect(jest.mocked(scenario.props.onChange).mock.calls[0][0]).toBe('new name');
  });

  it('Show error when empty name is specified', async () => {
    renderScenario({});

    screen.getByTestId('layer-name-div').click();
    const input = screen.getByTestId('layer-name-input');
    fireEvent.change(input, { target: { value: '' } });
    const alert = await screen.findByRole('alert');

    expect(alert.textContent).toBe('An empty layer name is not allowed');
  });

  it('Show error when other layer with same name exists', async () => {
    renderScenario({});

    screen.getByTestId('layer-name-div').click();
    const input = screen.getByTestId('layer-name-input');
    fireEvent.change(input, { target: { value: 'Layer 2' } });
    const alert = await screen.findByRole('alert');

    expect(alert.textContent).toBe('Layer name already exists');
  });

  function renderScenario(overrides: Partial<LayerNameProps>) {
    const props: LayerNameProps = {
      name: 'Layer 1',
      onChange: jest.fn(),
      verifyLayerNameUniqueness: (nameToCheck: string) => {
        const names = new Set(['Layer 1', 'Layer 2']);
        return !names.has(nameToCheck);
      },
    };

    Object.assign(props, overrides);

    return {
      props,
      renderResult: render(<LayerName {...props} />),
    };
  }
});
