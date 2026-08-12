import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AlertLabel } from './AlertLabel';

describe('Label', () => {
  it('renders label and value with correct aria-label', () => {
    render(<AlertLabel labelKey="foo" value="bar" />);

    const item = screen.getByTestId('label-value');
    expect(item).toBeInTheDocument();
    expect(item).toHaveAttribute('aria-label', 'foo: bar');
    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = jest.fn();
    render(<AlertLabel labelKey="env" value="prod" onClick={onClick} />);

    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(['prod', 'env']);
  });

  it('calls onClick when Enter is pressed', async () => {
    const onClick = jest.fn();
    render(<AlertLabel labelKey="region" value="eu-west-1" onClick={onClick} />);

    const button = screen.getByRole('button');
    await userEvent.type(button, '{enter}');
    expect(onClick).toHaveBeenCalledWith(['eu-west-1', 'region']);
  });
});
