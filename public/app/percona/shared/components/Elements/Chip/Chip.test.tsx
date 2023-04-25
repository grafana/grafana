import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { Chip } from './Chip';

describe('Chip::', () => {
  it('should render chips', () => {
    render(
      <div>
        <Chip text="chip1" />
        <Chip text="chip2" />
      </div>
    );
    expect(screen.getAllByTestId('chip')).toHaveLength(2);
  });

  it('should not render the cross icon if isRemovable is not passed', () => {
    render(
      <div>
        <Chip text="chip1" />
        <Chip text="chip2" />
      </div>
    );
    expect(screen.queryAllByTestId('chip-remove')).toHaveLength(0);
  });

  it('should remove chip from screen', () => {
    render(
      <div>
        <Chip isRemovable text="chip1" />
        <Chip isRemovable text="chip2" />
      </div>
    );

    const secondChipCrossIcon = screen.getAllByTestId('chip')[1].getElementsByTagName('svg')[0];

    fireEvent.click(secondChipCrossIcon);
    expect(screen.getAllByTestId('chip')).toHaveLength(1);
  });

  it('should call onRemove', () => {
    const spy = jest.fn();

    render(
      <div>
        <Chip isRemovable text="chip1" onRemove={spy} />
      </div>
    );
    fireEvent.click(screen.getByTestId('chip').getElementsByTagName('svg')[0]);
    expect(spy).toHaveBeenCalled();
  });
});
