import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';

import { locationService } from '@grafana/runtime';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { LocationType } from '../StorageLocations/StorageLocations.types';

import AddBackupPage from './AddBackupPage';
import { Messages } from './AddBackupPage.messages';

jest.mock('../ScheduledBackups/ScheduledBackups.service');
jest.mock('../BackupInventory/BackupInventory.service');
jest.mock('./AddBackupPage.service');
jest.mock('app/percona/backup/components/StorageLocations/StorageLocations.service');

const AddBackupPageWrapper: React.FC = ({ children }) => {
  return (
    <Provider
      store={configureStore({
        percona: {
          user: { isAuthorized: true, isPlatformUser: false },
          settings: { result: { backupEnabled: true, isConnectedToPortal: false } },
          backupLocations: {
            result: [
              {
                locationID: 'location_1',
                name: 'Location 1',
                type: LocationType.S3,
              },
              {
                locationID: 'location_2',
                name: 'Location 2',
                type: LocationType.CLIENT,
              },
            ],
            loading: false,
          },
        },
      } as unknown as StoreState)}
    >
      <Router history={locationService.getHistory()}>{children}</Router>
    </Provider>
  );
};

describe('AddBackupPage', () => {
  it('should render fields', async () => {
    render(
      <AddBackupPageWrapper>
        <AddBackupPage
          {...getRouteComponentProps({
            match: { params: { type: '', id: '' }, isExact: true, path: '', url: '' },
          })}
        />
      </AddBackupPageWrapper>
    );

    await waitFor(() => expect(screen.getAllByText('Choose')).toHaveLength(2));

    expect(screen.getAllByTestId('service-select-label')).toHaveLength(1);
    const textboxes = screen.getAllByRole('textbox');
    expect(textboxes.filter((textbox) => textbox.tagName === 'INPUT')).toHaveLength(2);
    expect(screen.queryByTestId('advanced-backup-fields')).not.toBeInTheDocument();

    expect(screen.queryByText(Messages.advanceSettings)).toBeInTheDocument();
    expect(screen.queryAllByText('Incremental')).toHaveLength(0);
    expect(screen.queryAllByText('Full')).toHaveLength(0);
  });

  it('should render advanced fields when in schedule mode', async () => {
    render(
      <AddBackupPageWrapper>
        <AddBackupPage
          {...getRouteComponentProps({
            match: { params: { type: 'scheduled_task_id', id: '' }, isExact: true, path: '', url: '' },
          })}
        />
      </AddBackupPageWrapper>
    );

    await waitFor(() => expect(screen.getAllByText('Choose')).toHaveLength(2));
    expect(screen.getByTestId('advanced-backup-fields')).toBeInTheDocument();
    expect(screen.getByTestId('multi-select-field-div-wrapper').children).not.toHaveLength(0);
    expect(screen.queryByText(Messages.advanceSettings)).toBeInTheDocument();
  });

  it('should render backup mode selector when in schedule mode', async () => {
    render(
      <AddBackupPageWrapper>
        <AddBackupPage
          {...getRouteComponentProps({
            match: { params: { type: 'scheduled_task_id', id: '' }, isExact: true, path: '', url: '' },
          })}
        />
      </AddBackupPageWrapper>
    );
    await waitFor(() => expect(screen.getAllByText('Choose')).toHaveLength(2));
    expect(screen.queryByText('Incremental')).toBeInTheDocument();
    expect(screen.queryByText('Full')).toBeInTheDocument();
  });

  it('should render demand page backup without params', async () => {
    render(
      <AddBackupPageWrapper>
        <AddBackupPage
          {...getRouteComponentProps({
            match: { params: { type: '', id: '' }, isExact: true, path: '', url: '' },
          })}
        />
      </AddBackupPageWrapper>
    );

    await waitFor(() => expect(screen.getAllByText('Choose')).toHaveLength(2));
    expect(screen.getByText('Create Backup on demand')).toBeInTheDocument();
  });

  it('should render schedule page backup with schedule params', async () => {
    render(
      <AddBackupPageWrapper>
        <AddBackupPage
          {...getRouteComponentProps({
            match: { params: { type: 'scheduled_task_id', id: '' }, isExact: true, path: '', url: '' },
          })}
        />
      </AddBackupPageWrapper>
    );

    await waitFor(() => expect(screen.getAllByText('Choose')).toHaveLength(2));
    expect(screen.getByText('Create Scheduled backup')).toBeInTheDocument();
  });

  it('should switch page to schedule backup page when click on schedule backup button', async () => {
    render(
      <AddBackupPageWrapper>
        <AddBackupPage
          {...getRouteComponentProps({
            match: { params: { type: '', id: '' }, isExact: true, path: '', url: '' },
          })}
        />
      </AddBackupPageWrapper>
    );

    await waitFor(() => expect(screen.getAllByText('Choose')).toHaveLength(2));
    const button = screen.queryAllByTestId('type-radio-button')[1];
    fireEvent.click(button);
    expect(screen.getByText('Create Scheduled backup')).toBeInTheDocument();
  });

  it('should switch back to demand backup page when click on demand backup button', async () => {
    render(
      <AddBackupPageWrapper>
        <AddBackupPage
          {...getRouteComponentProps({
            match: { params: { type: 'scheduled_task_id', id: '' }, isExact: true, path: '', url: '' },
          })}
        />
      </AddBackupPageWrapper>
    );

    await waitFor(() => expect(screen.getAllByText('Choose')).toHaveLength(2));
    const button = screen.queryAllByTestId('type-radio-button')[0];
    fireEvent.click(button);
    expect(screen.getByText('Create Backup on demand')).toBeInTheDocument();
  });
});
