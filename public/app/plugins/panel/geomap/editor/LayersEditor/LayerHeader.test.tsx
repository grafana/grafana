import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { LayerHeaderProps, LayerHeader } from './LayerHeader';

describe('LayerHeader', () => {
  it('Can edit title', () => {
    const scenario = renderScenario({});
    screen.getByTestId('layer-name-div').click();

    const input = screen.getByTestId('layer-name-input');
    fireEvent.change(input, { target: { value: 'new name' } });
    fireEvent.blur(input);

    expect((scenario.props.onChange as any).mock.calls[0][0].options.name).toBe('new name');
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

  function renderScenario(overrides: Partial<LayerHeaderProps>) {
    const props: any = {
      layer: {
        UID: '1',
        options: { name: 'Layer 1' },
      },
      layers: [
        {
          UID: '1',
          options: { name: 'Layer 1' },
        },
        {
          UID: '2',
          options: { name: 'Layer 2' },
        },
      ],
      onChange: jest.fn(),
    };

    Object.assign(props, overrides);

    return {
      props,
      renderResult: render(<LayerHeader {...props} />),
    };
  }
});
