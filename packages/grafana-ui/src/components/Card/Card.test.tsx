import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Card } from './Card';
import { Button } from '../Button';
import { IconButton } from '../IconButton/IconButton';

describe('Card', () => {
  it('should execute callback when clicked', () => {
    const callback = jest.fn();
    render(<Card heading="Test Heading" onClick={callback} />);
    fireEvent.click(screen.getByText('Test Heading'));
    expect(callback).toBeCalledTimes(1);
  });

  describe('Card Actions', () => {
    it('Children should be disabled or enabled according to Card disabled prop', () => {
      const { rerender } = render(
        <Card heading="Test Heading">
          <Card.Actions>
            <Button>Click Me</Button>
          </Card.Actions>
          <Card.SecondaryActions>
            <IconButton name="trash-alt" aria-label="Delete" />
          </Card.SecondaryActions>
        </Card>
      );

      expect(screen.getByRole('button', { name: 'Click Me' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Delete' })).not.toBeDisabled();

      rerender(
        <Card heading="Test Heading" disabled>
          <Card.Actions>
            <Button>Click Me</Button>
          </Card.Actions>
          <Card.SecondaryActions>
            <IconButton name="trash-alt" aria-label="Delete" />
          </Card.SecondaryActions>
        </Card>
      );

      expect(screen.getByRole('button', { name: 'Click Me' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    });

    it('Children should be independently enabled or disabled if explicitly set', () => {
      const { rerender } = render(
        <Card heading="Test Heading">
          <Card.Actions>
            <Button disabled>Click Me</Button>
          </Card.Actions>
          <Card.SecondaryActions>
            <IconButton name="trash-alt" aria-label="Delete" disabled />
          </Card.SecondaryActions>
        </Card>
      );

      expect(screen.getByRole('button', { name: 'Click Me' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();

      rerender(
        <Card heading="Test Heading" disabled>
          <Card.Actions>
            <Button disabled={false}>Click Me</Button>
          </Card.Actions>
          <Card.SecondaryActions>
            <IconButton name="trash-alt" aria-label="Delete" disabled={false} />
          </Card.SecondaryActions>
        </Card>
      );

      expect(screen.getByRole('button', { name: 'Click Me' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Delete' })).not.toBeDisabled();
    });
  });
});
