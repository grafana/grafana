import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createDefaultConfigOptions } from '../mocks/datasource';

import { ConfigEditor } from './ConfigEditor';

describe('ConfigEditor', () => {
  it('should render without error', () => {
    expect(() =>
      render(<ConfigEditor onOptionsChange={() => {}} options={createDefaultConfigOptions()} />)
    ).not.toThrow();
  });

  it('should render the right sections', () => {
    render(<ConfigEditor onOptionsChange={() => {}} options={createDefaultConfigOptions()} />);
    expect(screen.getByRole('heading', { name: 'Connection' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Authentication' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Advanced HTTP settings' })).toBeInTheDocument();
    expect(screen.getByText('Maximum lines')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Derived fields' })).toBeInTheDocument();
  });

  it('should pass correct data to onChange', async () => {
    const onChangeMock = jest.fn();
    render(<ConfigEditor onOptionsChange={onChangeMock} options={createDefaultConfigOptions()} />);
    const maxLinesInput = await screen.findByDisplayValue('531');
    await userEvent.type(maxLinesInput, '2');
    expect(onChangeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jsonData: expect.objectContaining({
          maxLines: '5312',
        }),
      })
    );
  });
});
