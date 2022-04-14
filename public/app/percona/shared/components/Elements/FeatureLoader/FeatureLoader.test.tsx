import React from 'react';
import { useSelector } from 'react-redux';
import { FeatureLoader } from './FeatureLoader';
import { Messages } from './FeatureLoader.messages';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('app/percona/settings/Settings.service');
jest.mock('@percona/platform-core', () => {
  const originalModule = jest.requireActual('@percona/platform-core');
  return {
    ...originalModule,
    logger: {
      error: jest.fn(),
    },
  };
});
jest.mock('react-redux', () => {
  const original = jest.requireActual('react-redux');
  return {
    ...original,
    useSelector: jest.fn(),
  };
});

describe('FeatureLoader', () => {
  beforeEach(() => {
    (useSelector as jest.Mock).mockImplementation((callback) => {
      return callback({
        perconaUser: { isAuthorized: true },
        perconaSettings: { isLoading: false, alertingEnabled: true },
      });
    });
  });

  afterEach(() => {
    (useSelector as jest.Mock).mockClear();
  });

  it('should not have children initially', async () => {
    (useSelector as jest.Mock).mockImplementation((callback) => {
      return callback({
        perconaUser: { isAuthorized: true },
        perconaSettings: { isLoading: false, alertingEnabled: false },
      });
    });

    const Dummy = () => <div data-testid="dummy" />;
    render(
      <FeatureLoader featureName="IA" featureSelector={(state) => !!state.perconaSettings.alertingEnabled}>
        <Dummy />
      </FeatureLoader>
    );

    expect(screen.queryByTestId('dummy')).not.toBeInTheDocument();
    expect(screen.getByTestId('empty-block')).toBeInTheDocument();
  });

  it('should show children after loading settings', async () => {
    const Dummy = () => <div data-testid="dummy" />;
    await waitFor(() =>
      render(
        <FeatureLoader featureName="IA" featureSelector={(state) => !!state.perconaSettings.alertingEnabled}>
          <Dummy />
        </FeatureLoader>
      )
    );

    expect(screen.getByTestId('dummy')).toBeInTheDocument();
    expect(screen.queryByTestId('empty-block')).not.toBeInTheDocument();
  });

  it('should show insufficient access permissions message', async () => {
    (useSelector as jest.Mock).mockImplementation((callback) => {
      return callback({
        perconaUser: { isAuthorized: false },
        perconaSettings: { isLoading: false, alertingEnabled: false },
      });
    });

    await waitFor(() =>
      render(<FeatureLoader featureName="IA" featureSelector={(state) => !!state.perconaSettings.alertingEnabled} />)
    );

    expect(screen.getByTestId('unauthorized')).toHaveTextContent(Messages.unauthorized);
  });
});
