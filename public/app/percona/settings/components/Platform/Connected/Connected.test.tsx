import React from 'react';
import { render, screen } from '@testing-library/react';
import { Connected } from './Connected';
import { Messages } from './Connected.messages';

describe('Connected::', () => {
  it('render connected message', () => {
    render(<Connected getSettings={() => null} />);

    const wrapper = screen.getByTestId('connected-wrapper');

    expect(wrapper).toBeInTheDocument();
    expect(wrapper.textContent?.includes(Messages.connected)).toBeTruthy();
  });
});
