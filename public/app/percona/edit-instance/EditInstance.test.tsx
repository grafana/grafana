import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom-v5-compat';

import { configureStore } from 'app/store/configureStore';

import { stubWithLabels } from '../inventory/__mocks__/Inventory.service';
import { wrapWithGrafanaContextMock } from '../shared/helpers/testUtils';

import EditInstancePage from './EditInstance';
import { fromPayload } from './EditInstance.utils';

jest.mock('app/percona/inventory/Inventory.service');

const renderWithDefaults = () =>
  render(
    <MemoryRouter initialEntries={['/edit-instance/service_id']}>
      <Routes>
        <Route
          path="/edit-instance/:serviceId"
          element={<Provider store={configureStore()}>{wrapWithGrafanaContextMock(<EditInstancePage />)}</Provider>}
        />
      </Routes>
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
