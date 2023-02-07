import { screen, render, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { Form } from 'react-final-form';
import { Provider } from 'react-redux';

import { configureStore } from '../../../../../../store/configureStore';
import { StoreState } from '../../../../../../types';

import DBaaSBackups from './DBaaSBackups';

jest.mock('app/percona/dbaas/components/Kubernetes/Kubernetes.service');
jest.mock('app/percona/backup/components/StorageLocations/StorageLocations.service');

const store = configureStore({
  percona: {
    user: { isAuthorized: true },
    kubernetes: {
      loading: false,
    },
  },
} as StoreState);
describe('DBaaSBackups Scheduled Section ::', () => {
  it('renders items correctly, shows fields on switch on', async () => {
    await waitFor(() =>
      render(
        <Provider store={store}>
          <Form
            onSubmit={jest.fn()}
            initialValues={{
              day: [],
              month: [],
              period: { value: 'year', label: 'every year' },
              startHour: [{ label: '00', value: 0 }],
              startMinute: [{ value: 0, label: '00' }],
              weekDay: [],
            }}
            render={({ form, handleSubmit, pristine, valid, ...props }) => (
              <DBaaSBackups handleSubmit={handleSubmit} pristine={pristine} valid={valid} form={form} {...props} />
            )}
          />
        </Provider>
      )
    );
    expect(screen.getByTestId('toggle-scheduled-backup')).toBeInTheDocument();
    const checkbox = screen.getByTestId('toggle-scheduled-backup');

    fireEvent.click(checkbox);
    expect(screen.getByTestId('location-select-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('retention-field-container')).toBeInTheDocument();
    expect(screen.getByTestId('shedule-section-fields-wrapper')).toBeInTheDocument();
  });
});
