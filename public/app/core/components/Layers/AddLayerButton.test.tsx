import { render, screen } from '@testing-library/react';
import React from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { AddLayerButton, AddLayerButtonProps } from './AddLayerButton';

describe('AddLayerButton', () => {
  const testLabel = 'Add Layer';
  it('renders AddLayerButton', () => {
    renderScenario({});

    const button = screen.getByLabelText(selectors.components.ValuePicker.button(testLabel));

    expect(button).toBeInTheDocument();
  });

  function renderScenario(overrides: Partial<AddLayerButtonProps>) {
    const dummyOptions = [{ description: 'Use markers to render each data point', label: 'Markers', value: 'markers' }];
    const props: AddLayerButtonProps = {
      onChange: jest.fn(),
      options: dummyOptions,
      label: testLabel,
    };

    Object.assign(props, overrides);

    return {
      props,
      renderResult: render(<AddLayerButton {...props} />),
    };
  }
});
