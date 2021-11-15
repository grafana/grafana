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

    expect((scenario.props.onChange as any).mock.calls[0][0].name).toBe('new name');
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
    const props: LayerHeaderProps = {
      layer: { name: 'Layer 1', type: '?' },
      canRename: (v: string) => {
        const names = new Set(['Layer 1', 'Layer 2']);
        return !names.has(v);
      },
      onChange: jest.fn(),
    };

    Object.assign(props, overrides);

    return {
      props,
      renderResult: render(<LayerHeader {...props} />),
    };
  }
});
