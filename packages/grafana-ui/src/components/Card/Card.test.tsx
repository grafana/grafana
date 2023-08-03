import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import { Button } from '../Button';
import { IconButton } from '../IconButton/IconButton';

import { Card } from './Card';

describe('Card', () => {
  it('should execute callback when clicked', () => {
    const callback = jest.fn();
    render(
      <Card onClick={callback}>
        <Card.Heading>Test Heading</Card.Heading>
      </Card>
    );
    fireEvent.click(screen.getByText('Test Heading'));
    expect(callback).toBeCalledTimes(1);
  });

  describe('Card Actions', () => {
    it('Children should be disabled or enabled according to Card disabled prop', () => {
      const { rerender } = render(
        <Card>
          <Card.Heading>Test Heading</Card.Heading>
          <Card.Actions>
            <Button>Click Me</Button>
          </Card.Actions>
          <Card.SecondaryActions>
            <IconButton name="trash-alt" aria-label="Delete" tooltip="Delete" />
          </Card.SecondaryActions>
        </Card>
      );

      expect(screen.getByRole('button', { name: 'Click Me' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Delete' })).not.toBeDisabled();

      rerender(
        <Card disabled>
          <Card.Heading>Test Heading</Card.Heading>
          <Card.Actions>
            <Button>Click Me</Button>
          </Card.Actions>
          <Card.SecondaryActions>
            <IconButton name="trash-alt" aria-label="Delete" tooltip="Delete" />
          </Card.SecondaryActions>
        </Card>
      );

      expect(screen.getByRole('button', { name: 'Click Me' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    });

    it('Children should be independently enabled or disabled if explicitly set', () => {
      const { rerender } = render(
        <Card>
          <Card.Heading>Test Heading</Card.Heading>
          <Card.Actions>
            <Button disabled>Click Me</Button>
          </Card.Actions>
          <Card.SecondaryActions>
            <IconButton name="trash-alt" aria-label="Delete" tooltip="Delete" disabled />
          </Card.SecondaryActions>
        </Card>
      );

      expect(screen.getByRole('button', { name: 'Click Me' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();

      rerender(
        <Card disabled>
          <Card.Heading>Test Heading</Card.Heading>
          <Card.Actions>
            <Button disabled={false}>Click Me</Button>
          </Card.Actions>
          <Card.SecondaryActions>
            <IconButton name="trash-alt" aria-label="Delete" tooltip="Delete" disabled={false} />
          </Card.SecondaryActions>
        </Card>
      );

      expect(screen.getByRole('button', { name: 'Click Me' })).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Delete' })).not.toBeDisabled();
    });

    it('Children should be conditional', () => {
      const shouldNotRender = false;
      render(
        <Card>
          <Card.Heading>Test Heading</Card.Heading>
          <Card.Actions>
            <Button>Click Me</Button>
            {shouldNotRender && <Button>Delete</Button>}
          </Card.Actions>
          <Card.SecondaryActions>
            {shouldNotRender && <IconButton name="trash-alt" aria-label="Delete" tooltip="Delete" disabled={false} />}
          </Card.SecondaryActions>
        </Card>
      );

      expect(screen.getByRole('button', { name: 'Click Me' })).not.toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('Should allow selectable cards', () => {
      const { rerender } = render(
        <Card isSelected={true}>
          <Card.Heading>My Option</Card.Heading>
        </Card>
      );

      expect(screen.getByRole('radio')).toBeInTheDocument();
      expect(screen.getByRole('radio')).toBeChecked();

      rerender(
        <Card isSelected={false}>
          <Card.Heading>My Option</Card.Heading>
        </Card>
      );

      expect(screen.getByRole('radio')).toBeInTheDocument();
      expect(screen.getByRole('radio')).not.toBeChecked();

      rerender(
        <Card>
          <Card.Heading>My Option</Card.Heading>
        </Card>
      );

      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    });
  });
});
