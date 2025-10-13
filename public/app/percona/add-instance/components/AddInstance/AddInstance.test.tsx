import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';

import { wrapWithGrafanaContextMock } from 'app/percona/shared/helpers/testUtils';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { InstanceAvailable } from '../../panel.types';

import { AddInstance } from './AddInstance';
import { instanceList } from './AddInstance.constants';

jest.mock('app/percona/settings/Settings.service');

const selectedInstanceType: InstanceAvailable = { type: '' };

describe('AddInstance page::', () => {
  it('should render a given number of links', async () => {
    const ui = withStore(
      <AddInstance showAzure={false} onSelectInstanceType={() => {}} selectedInstanceType={selectedInstanceType} />
    );
    await waitFor(() => render(ui));

    expect(screen.getAllByRole('button')).toHaveLength(instanceList.length);
    instanceList.forEach((item) => {
      expect(screen.getByTestId(`${item.type}-instance`)).toBeInTheDocument();
    });
  });

  it('should render azure option', async () => {
    const ui = withStore(
      <AddInstance showAzure onSelectInstanceType={() => {}} selectedInstanceType={selectedInstanceType} />
    );
    await waitFor(() => render(ui));

    expect(screen.getAllByRole('button')).toHaveLength(instanceList.length + 1);
    instanceList.forEach((item) => {
      expect(screen.getByTestId(`${item.type}-instance`)).toBeInTheDocument();
    });
    expect(screen.getByTestId('azure-instance')).toBeInTheDocument();
  });

  it('should invoke a callback with a proper instance type', async () => {
    const onSelectInstanceType = jest.fn();

    const ui = withStore(
      <AddInstance showAzure onSelectInstanceType={onSelectInstanceType} selectedInstanceType={selectedInstanceType} />
    );
    render(ui);

    expect(onSelectInstanceType).toBeCalledTimes(0);

    const button = (await screen.findByTestId('rds-instance')).querySelector('button');
    fireEvent.click(button!);

    expect(onSelectInstanceType).toBeCalledTimes(1);
    expect(onSelectInstanceType.mock.calls[0][0]).toStrictEqual({ type: 'rds' });
  });
});

const withStore = (el: React.ReactElement): React.ReactElement =>
  wrapWithGrafanaContextMock(<Provider store={configureStore({} as StoreState)}>{el}</Provider>);
