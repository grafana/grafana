import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Row } from 'react-table';

import * as ServicesReducer from 'app/percona/shared/core/reducers/services/services';
import { ServiceStatus } from 'app/percona/shared/services/services/Services.types';
import { configureStore } from 'app/store/configureStore';

import { FlattenService } from '../../Inventory.types';

import DeleteServiceModal from './DeleteServicesModal';

const cancelFn = jest.fn();
const successFn = jest.fn();
const removeServicesActionSpy = jest.spyOn(ServicesReducer, 'removeServicesAction');

jest.mock('app/percona/inventory/Inventory.service');
jest.mock('app/percona/shared/services/services/Services.service');

const serviceStub: FlattenService = {
  nodeId: 'Node #1',
  nodeName: 'Node #1',
  serviceId: 'Service #1',
  serviceName: 'Service #1',
  status: ServiceStatus.NA,
  agentsStatus: 'N/A',
  type: 'external',
};

const serviceStub2: FlattenService = {
  nodeId: 'Node #2',
  nodeName: 'Node #2',
  serviceId: 'Service #2',
  serviceName: 'Service #2',
  status: ServiceStatus.NA,
  agentsStatus: 'N/A',
  type: 'external',
};

const servicesStub = [
  {
    original: serviceStub,
  },
];

const servicesStubMulti = [
  {
    original: serviceStub,
  },
  {
    original: serviceStub2,
  },
];

const renderDefaults = (isOpen = true, services = servicesStub) =>
  render(
    <Provider store={configureStore()}>
      <DeleteServiceModal
        onDismiss={cancelFn}
        isOpen={isOpen}
        onSuccess={successFn}
        services={services as unknown as Array<Row<FlattenService>>}
      />
    </Provider>
  );

describe('DeleteServicesModal::', () => {
  beforeEach(() => {
    cancelFn.mockClear();
    removeServicesActionSpy.mockClear();
  });

  it("doesn't render if not opened", () => {
    renderDefaults(false);
    expect(screen.queryByTestId('delete-services-description')).toBe(null);
  });

  it('renders when opened', () => {
    renderDefaults();
    expect(screen.queryByTestId('delete-services-description')).toBeInTheDocument();
  });

  it('can be cancelled', () => {
    renderDefaults();

    const cancelButton = screen.getByTestId('delete-services-cancel');
    fireEvent.click(cancelButton);

    expect(cancelFn).toHaveBeenCalled();
  });

  it('calls delete', () => {
    renderDefaults();

    const confirmButton = screen.getByTestId('delete-services-confirm');
    fireEvent.click(confirmButton);

    expect(removeServicesActionSpy).toHaveBeenCalledWith({
      services: [
        {
          serviceId: serviceStub.serviceId,
          force: false,
        },
      ],
    });
  });

  it('calls delete for all services', async () => {
    renderDefaults(true, servicesStubMulti);

    const confirmButton = screen.getByTestId('delete-services-confirm');
    fireEvent.click(confirmButton);

    expect(removeServicesActionSpy).toHaveBeenCalledWith({
      services: [
        {
          serviceId: serviceStub.serviceId,
          force: false,
        },
        {
          serviceId: serviceStub2.serviceId,
          force: false,
        },
      ],
    });
  });

  it('calls delete with force mode', async () => {
    renderDefaults();

    const forceModeCheck = screen.getByTestId('delete-services-force-mode');
    await waitFor(() => fireEvent.click(forceModeCheck));

    const confirmButton = screen.getByTestId('delete-services-confirm');
    await waitFor(() => fireEvent.click(confirmButton));

    expect(removeServicesActionSpy).toHaveBeenCalledWith({
      services: [
        {
          serviceId: serviceStub.serviceId,
          force: true,
        },
      ],
    });
  });

  it('resets force mode after submit', async () => {
    renderDefaults();

    const forceModeCheck = screen.getByTestId('delete-services-force-mode');
    await waitFor(() => fireEvent.click(forceModeCheck));

    expect(forceModeCheck).toBeChecked();

    const confirmButton = screen.getByTestId('delete-services-confirm');
    fireEvent.click(confirmButton);

    await waitFor(() => expect(forceModeCheck).not.toBeChecked());
  });

  it('resets force mode after dismiss', async () => {
    renderDefaults();

    const forceModeCheck = screen.getByTestId('delete-services-force-mode');
    await waitFor(() => fireEvent.click(forceModeCheck));

    expect(forceModeCheck).toBeChecked();

    const cancelButton = screen.getByTestId('delete-services-cancel');
    fireEvent.click(cancelButton);

    await waitFor(() => expect(forceModeCheck).not.toBeChecked());
  });
});
