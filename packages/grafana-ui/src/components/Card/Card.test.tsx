import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Button } from '../Button/Button';
import { IconButton } from '../IconButton/IconButton';

import { Card } from './Card';

describe('Card', () => {
  it('should execute callback when clicked', async () => {
    const user = userEvent.setup();
    const callback = jest.fn();
    render(
      <Card noMargin onClick={callback}>
        <Card.Heading>Test Heading</Card.Heading>
      </Card>
    );
    await user.click(screen.getByText('Test Heading'));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  describe('Card Actions', () => {
    it('Children should be disabled or enabled according to Card disabled prop', () => {
      const { rerender } = render(
        <Card noMargin>
          <Card.Heading>Test Heading</Card.Heading>
          <Card.Actions>
            <Button>Click Me</Button>
          </Card.Actions>
          <Card.SecondaryActions>
            <IconButton name="trash-alt" aria-label="Delete" tooltip="Delete" />
          </Card.SecondaryActions>
        </Card>
      );

      expect(screen.getByRole('button', { name: 'Click Me' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();

      rerender(
        <Card noMargin disabled>
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
        <Card noMargin>
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
        <Card noMargin disabled>
          <Card.Heading>Test Heading</Card.Heading>
          <Card.Actions>
            <Button disabled={false}>Click Me</Button>
          </Card.Actions>
          <Card.SecondaryActions>
            <IconButton name="trash-alt" aria-label="Delete" tooltip="Delete" disabled={false} />
          </Card.SecondaryActions>
        </Card>
      );

      expect(screen.getByRole('button', { name: 'Click Me' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
    });

    it('Children should be conditional', () => {
      const shouldNotRender = false;
      render(
        <Card noMargin>
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

      expect(screen.getByRole('button', { name: 'Click Me' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('Should allow selectable cards', () => {
      const { rerender } = render(
        <Card noMargin isSelected={true}>
          <Card.Heading>My Option</Card.Heading>
        </Card>
      );

      expect(screen.getByRole('radio')).toBeInTheDocument();
      expect(screen.getByRole('radio')).toBeChecked();

      rerender(
        <Card noMargin isSelected={false}>
          <Card.Heading>My Option</Card.Heading>
        </Card>
      );

      expect(screen.getByRole('radio')).toBeInTheDocument();
      expect(screen.getByRole('radio')).not.toBeChecked();

      rerender(
        <Card noMargin>
          <Card.Heading>My Option</Card.Heading>
        </Card>
      );

      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    });
  });
});
