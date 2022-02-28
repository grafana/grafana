import React from 'react';
import { EditDBClusterModal } from './EditDBClusterModal';
import { setVisibleStub, onDBClusterAddedStub } from './__mocks__/editDBClusterModalStubs';
import { dbClustersStub } from '../__mocks__/dbClustersStubs';
import { render, screen } from '@testing-library/react';

jest.mock('app/core/app_events');
jest.mock('../DBCluster.service');
jest.mock('../PSMDB.service');
jest.mock('../XtraDB.service');

describe('EditDBClusterModal::', () => {
  it('should render advanced options', async () => {
    render(
      <EditDBClusterModal
        isVisible
        setVisible={setVisibleStub}
        onDBClusterChanged={onDBClusterAddedStub}
        selectedCluster={dbClustersStub[0]}
      />
    );

    expect(await screen.findAllByTestId('resources-radio-button')).toBeTruthy();
    expect(screen.getByTestId('memory-field-container')).toBeInTheDocument();
    expect(screen.getByTestId('cpu-field-container')).toBeInTheDocument();
    expect(screen.getByTestId('disk-field-container')).toBeInTheDocument();
    expect(screen.getByTestId('disk-number-input')).toBeDisabled();
    expect(await screen.findAllByTestId('resources-bar')).toBeTruthy();
  });
});
