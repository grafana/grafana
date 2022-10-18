import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { LocationType, S3Location, StorageLocation } from '../StorageLocations.types';

import { AddStorageLocationModal } from './AddStorageLocationModal';
import { Messages } from './AddStorageLocationModal.messages';

describe('AddStorageLocationModal', () => {
  it('should render local TypeField', () => {
    const location: StorageLocation = {
      locationID: 'Location_1',
      name: 'client_fs',
      description: 'description',
      type: LocationType.CLIENT,
      path: '/foo/bar',
    };
    render(<AddStorageLocationModal location={location} onClose={jest.fn()} onAdd={jest.fn()} isVisible />);
    expect(screen.getByTestId('client-field-container')).toBeInTheDocument();
  });

  it('should render S3 TypeField', () => {
    const location: S3Location = {
      locationID: 'Location_1',
      name: 'client_fs',
      description: 'description',
      type: LocationType.S3,
      path: '/foo/bar',
      accessKey: 'accessKey',
      secretKey: 'secretKey',
      bucketName: 'bucket',
    };
    render(<AddStorageLocationModal location={location} onClose={jest.fn()} onAdd={jest.fn()} isVisible />);
    expect(screen.queryByTestId('bucketName-field-container')).toBeInTheDocument();
    expect(screen.queryByTestId('accessKey-field-container')).toBeInTheDocument();
    expect(screen.queryByTestId('secretKey-field-container')).toBeInTheDocument();
    expect(screen.queryByTestId('endpoint-field-container')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /endpoint/i })).toHaveValue('/foo/bar');
  });

  it('should not render unknown type fields', () => {
    const location: StorageLocation = {
      locationID: 'Location_1',
      name: 'client_fs',
      description: 'description',
      path: '',
      type: 'unknwon' as LocationType,
    };
    render(<AddStorageLocationModal location={location} onClose={jest.fn()} onAdd={jest.fn()} isVisible />);

    //S3Fields
    expect(screen.queryByTestId('bucketName-field-container')).not.toBeInTheDocument();
    expect(screen.queryByTestId('accessKey-field-container')).not.toBeInTheDocument();
    expect(screen.queryByTestId('secretKey-field-container')).not.toBeInTheDocument();
    expect(screen.queryByTestId('endpoint-field-container')).not.toBeInTheDocument();
    //LocalFields
    expect(screen.queryByTestId('client-field-container')).not.toBeInTheDocument();
  });

  it('should call onAdd callback', () => {
    const onAdd = jest.fn();
    const location: S3Location = {
      locationID: 'Location_1',
      name: 'client_fs',
      description: 'description',
      type: LocationType.S3,
      path: '/foo/bar',
      accessKey: 'accessKey',
      secretKey: 'secretKey',
      bucketName: 'bucket',
    };
    render(<AddStorageLocationModal location={location} onClose={jest.fn()} onAdd={onAdd} isVisible />);

    const endpointInput = screen.getByTestId('endpoint-text-input');
    fireEvent.change(endpointInput, { target: { value: 's3://foo' } });
    const form = screen.getByTestId('add-storage-location-modal-form');
    fireEvent.submit(form);

    expect(onAdd).toHaveBeenCalled();
  });

  it('should show the "Add" button when no location passed', () => {
    render(<AddStorageLocationModal location={null} onClose={jest.fn()} onAdd={jest.fn()} isVisible />);
    expect(screen.getAllByTestId('storage-location-add-button')[0].textContent).toBe(Messages.addAction);
  });

  it('should show the "Edit" button when a location is passed', () => {
    const location: StorageLocation = {
      locationID: 'Location_1',
      name: 'client_fs',
      description: 'description',
      type: LocationType.CLIENT,
      path: '/foo/bar',
    };
    render(<AddStorageLocationModal location={location} onClose={jest.fn()} onAdd={jest.fn()} isVisible />);
    expect(screen.getAllByTestId('storage-location-add-button')[0].textContent).toBe(Messages.editAction);
  });

  it('should have the test button', () => {
    render(<AddStorageLocationModal location={null} onClose={jest.fn()} onAdd={jest.fn()} isVisible />);

    expect(screen.getByTestId('storage-location-test-button')).toBeInTheDocument();
  });

  it('should disable the test button if the form is invalid', () => {
    render(<AddStorageLocationModal location={null} onClose={jest.fn()} onAdd={jest.fn()} isVisible />);
    const buttons = screen.getAllByTestId('storage-location-test-button');
    expect(buttons[buttons.length - 1]).toBeDisabled();
  });

  it("should enable the test button if the form is valid and it's an S3 storage", () => {
    const location: S3Location = {
      locationID: 'Location_1',
      name: 'client_fs',
      description: 'description',
      type: LocationType.S3,
      path: '/foo/bar',
      accessKey: 'key',
      secretKey: 'key',
      bucketName: 'bucket',
    };
    render(<AddStorageLocationModal location={location} onClose={jest.fn()} onAdd={jest.fn()} isVisible />);

    const buttons = screen.getAllByTestId('storage-location-test-button');
    expect(buttons[buttons.length - 1]).not.toBeDisabled();
  });

  it('should hide test button with client storage', () => {
    const location: StorageLocation = {
      locationID: 'Location_1',
      name: 'client_fs',
      description: 'description',
      type: LocationType.CLIENT,
      path: '/foo/bar',
    };
    render(<AddStorageLocationModal location={location} onClose={jest.fn()} onAdd={jest.fn()} isVisible />);

    expect(screen.queryByTestId('torage-location-test-button')).not.toBeInTheDocument();
  });

  it('should disable the add button while waiting for test validation', () => {
    const location: StorageLocation = {
      locationID: 'Location_1',
      name: 'client_fs',
      description: 'description',
      type: LocationType.CLIENT,
      path: '/foo/bar',
    };
    render(
      <AddStorageLocationModal
        location={location}
        waitingLocationValidation
        onClose={jest.fn()}
        onAdd={jest.fn()}
        isVisible
      />
    );

    const buttons = screen.getAllByTestId('storage-location-add-button');
    expect(buttons[buttons.length - 1]).toBeDisabled();
  });
});
