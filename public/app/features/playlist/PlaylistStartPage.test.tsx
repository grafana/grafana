import { render } from '@testing-library/react';
import { useParams, useNavigationType } from 'react-router-dom-v5-compat';

import { locationService } from '@grafana/runtime';

import { playlistSrv } from './PlaylistSrv';
import PlaylistStartPage from './PlaylistStartPage';

// Mock the dependencies
jest.mock('react-router-dom-v5-compat', () => ({
  useParams: jest.fn(),
  useNavigationType: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  locationService: {
    getHistory: jest.fn().mockReturnValue({
      goBack: jest.fn(),
    }),
  },
}));

jest.mock('./PlaylistSrv', () => ({
  playlistSrv: {
    start: jest.fn(),
  },
}));

describe('PlaylistStartPage', () => {
  afterEach(() => {
    jest.clearAllMocks(); // Clear mocks after each test
  });

  it('should call locationService.getHistory().goBack() when navigationType is "POP"', () => {
    // Arrange: Set up the mock return value for useParams and useNavigationType
    (useParams as jest.Mock).mockReturnValue({ uid: '123' });
    (useNavigationType as jest.Mock).mockReturnValue('POP');

    // Act: Render the component
    render(<PlaylistStartPage />);

    // Assert: Check if goBack was called
    expect(locationService.getHistory().goBack).toHaveBeenCalledTimes(1);
    expect(playlistSrv.start).not.toHaveBeenCalled(); // Should not call start
  });

  it('should call playlistSrv.start() when navigationType is not "POP"', () => {
    // Arrange: Set up the mock return value for useParams and useNavigationType
    (useParams as jest.Mock).mockReturnValue({ uid: '123' });
    (useNavigationType as jest.Mock).mockReturnValue('PUSH'); // or any other type

    // Act: Render the component
    render(<PlaylistStartPage />);

    // Assert: Check if playlistSrv.start was called with correct uid
    expect(playlistSrv.start).toHaveBeenCalledWith('123');
    expect(locationService.getHistory().goBack).not.toHaveBeenCalled(); // Should not call goBack
  });
});
