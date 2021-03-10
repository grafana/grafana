import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('should execute callback when clicked', () => {
    const callback = jest.fn();
    render(<Card heading="Test Heading" onClick={callback} />);
    fireEvent.click(screen.getByText('Test Heading'));
    expect(callback).toBeCalledTimes(1);
  });
});
