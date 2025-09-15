import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Label } from './AlertLabel';

describe('Label', () => {
  it('renders label and value with correct aria-label', () => {
    render(<Label label="foo" value="bar" />);

    const item = screen.getByTestId('label-value');
    expect(item).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'foo: bar' })).toBeInTheDocument();
    expect(screen.getByText('foo')).toBeInTheDocument();
    expect(screen.getByText('bar')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = jest.fn();
    render(<Label label="env" value="prod" onClick={onClick} />);

    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith('env', 'prod');
  });

  it('calls onClick when Enter is pressed', async () => {
    const onClick = jest.fn();
    render(<Label label="region" value="eu-west-1" onClick={onClick} />);

    const button = screen.getByRole('button');
    await userEvent.type(button, '{enter}');
    expect(onClick).toHaveBeenCalledWith('region', 'eu-west-1');
  });
});
