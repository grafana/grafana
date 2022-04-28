import React from 'react';
import { AddInstance } from './AddInstance';
import { instanceList } from './AddInstance.constants';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

jest.mock('app/percona/settings/Settings.service');

describe('AddInstance page::', () => {
  it('should render a given number of links', async () => {
    await waitFor(() => render(<AddInstance showAzure={false} onSelectInstanceType={() => {}} />));

    expect(screen.getAllByRole('button')).toHaveLength(instanceList.length);
    instanceList.forEach((item) => {
      expect(screen.getByTestId(`${item.type}-instance`)).toBeInTheDocument();
    });
  });

  it('should render azure option', async () => {
    await waitFor(() => render(<AddInstance showAzure onSelectInstanceType={() => {}} />));

    expect(screen.getAllByRole('button')).toHaveLength(instanceList.length + 1);
    instanceList.forEach((item) => {
      expect(screen.getByTestId(`${item.type}-instance`)).toBeInTheDocument();
    });
    expect(screen.getByTestId('azure-instance')).toBeInTheDocument();
  });

  it('should invoke a callback with a proper instance type', async () => {
    const onSelectInstanceType = jest.fn();

    render(<AddInstance showAzure onSelectInstanceType={onSelectInstanceType} />);

    expect(onSelectInstanceType).toBeCalledTimes(0);

    const button = await screen.findByTestId('rds-instance');
    fireEvent.click(button);

    expect(onSelectInstanceType).toBeCalledTimes(1);
    expect(onSelectInstanceType.mock.calls[0][0]).toStrictEqual({ type: 'rds' });
  });
});
