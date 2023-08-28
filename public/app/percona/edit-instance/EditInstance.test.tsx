import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';

import { configureStore } from 'app/store/configureStore';

import { stubWithLabels } from '../inventory/__mocks__/Inventory.service';

import EditInstancePage from './EditInstance';
import { fromPayload } from './EditInstance.utils';

jest.mock('app/percona/inventory/Inventory.service');

const renderWithDefaults = () =>
  render(
    <MemoryRouter initialEntries={['/edit-instance/service_id']}>
      <Provider store={configureStore()}>
        <EditInstancePage />
      </Provider>
    </MemoryRouter>
  );

describe('EditInstance::', () => {
  it('prefills current values', async () => {
    renderWithDefaults();

    await waitFor(() => expect(screen.queryByLabelText('Environment')).toHaveValue(stubWithLabels.environment));
    await waitFor(() => expect(screen.queryByLabelText('Cluster')).toHaveValue(stubWithLabels.cluster));
    await waitFor(() => expect(screen.queryByLabelText('Replication set')).toHaveValue(stubWithLabels.replication_set));
    await waitFor(() =>
      expect(screen.queryByLabelText('Custom labels')).toHaveValue(fromPayload(stubWithLabels.custom_labels))
    );
  });
});
