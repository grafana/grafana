import React from 'react';
import { dataTestId } from '@percona/platform-core';
import { StorageLocationsService } from './StorageLocations.service';
import { stubLocations } from './__mocks__/StorageLocations.service';
import { StorageLocations } from './StorageLocations';
import { AddStorageLocationModal } from './AddStorageLocationModal';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('./StorageLocations.service');
jest.mock('app/core/app_events');
jest.mock('./AddStorageLocationModal', () => ({
  AddStorageLocationModal: jest.fn(({ children }) => <div data-testid="addStorageLocationModal">{children}</div>),
}));

describe('StorageLocations', () => {
  it('should render table with data', async () => {
    await waitFor(() => render(<StorageLocations />));
    expect(screen.getByTestId('table-tbody').querySelectorAll('tr')).toHaveLength(3);
    expect(screen.getByText('first location')).toBeInTheDocument();
    expect(screen.getByText('s3://foo/bar')).toBeInTheDocument();
    expect(screen.getByText('second location')).toBeInTheDocument();
    expect(screen.getByText('/path/to/server')).toBeInTheDocument();
    expect(screen.getByText('third location')).toBeInTheDocument();
    expect(screen.getByText('/path/to/client')).toBeInTheDocument();
  });

  it('should show delete modal when icon is clicked', async () => {
    await waitFor(() => render(<StorageLocations />));

    const modalsBeforeClick = screen.queryAllByTestId('modal-wrapper');
    expect(modalsBeforeClick).toHaveLength(0);
    expect(screen.queryByTestId('confirm-delete-modal-button')).not.toBeInTheDocument();

    const btns = screen.getAllByTestId('delete-storage-location-button');
    await waitFor(() => fireEvent.click(btns[btns.length - 1]));

    const modalsAfterClick = screen.queryAllByTestId('modal-wrapper');
    expect(modalsAfterClick).toHaveLength(1);
    expect(screen.getByTestId('confirm-delete-modal-button')).toBeInTheDocument();
  });

  it('should close delete modal after deletion confirmation', async () => {
    const spy = spyOn(StorageLocationsService, 'delete').and.callThrough();
    const { container } = await waitFor(() => render(<StorageLocations />));

    const trFirst = container.querySelectorAll('tbody tr')[0];
    const btns = trFirst.querySelectorAll(dataTestId('delete-storage-location-button'));
    await waitFor(() => fireEvent.click(btns[btns.length - 1]));

    const modalsBeforeSubmit = screen.queryAllByTestId('modal-wrapper');
    expect(modalsBeforeSubmit).toHaveLength(1);
    const loaderButton = screen.getByTestId('confirm-delete-modal-button');
    expect(loaderButton).toBeInTheDocument();
    await waitFor(() => fireEvent.submit(loaderButton));

    const modalsAfterSubmit = screen.queryAllByTestId('modal-wrapper');
    expect(modalsAfterSubmit).toHaveLength(0);
    expect(screen.queryByTestId('confirm-delete-modal-button')).not.toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith(stubLocations.locations[0].location_id, false);
  });

  it('should open the modal by clicking the "Add" button', async () => {
    await waitFor(() => render(<StorageLocations />));
    expect(AddStorageLocationModal).toHaveBeenCalledWith(
      expect.objectContaining({ isVisible: false }),
      expect.anything()
    );

    const addModalButton = screen.getByTestId('storage-location-add-modal-button');
    await waitFor(() => fireEvent.click(addModalButton));

    expect(AddStorageLocationModal).toHaveBeenCalledWith(
      expect.objectContaining({ isVisible: true }),
      expect.anything()
    );
  });
});
