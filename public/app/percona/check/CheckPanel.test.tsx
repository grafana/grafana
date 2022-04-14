import React from 'react';
import { CheckPanel } from './CheckPanel';
import { useSelector } from 'react-redux';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { render } from '@testing-library/react';
import { Messages } from './CheckPanel.messages';

const fakeLocationUpdate = jest.fn();

jest.mock('./Check.service');
jest.mock('../settings/Settings.service');
jest.mock('react-redux', () => {
  const original = jest.requireActual('react-redux');
  return {
    ...original,
    useSelector: jest.fn(),
  };
});

jest.mock('@grafana/runtime', () => {
  const original = jest.requireActual('@grafana/runtime');
  return {
    ...original,
    getLocationSrv: jest.fn().mockImplementation(() => ({ update: fakeLocationUpdate })),
  };
});

jest.mock('@percona/platform-core', () => {
  const originalModule = jest.requireActual('@percona/platform-core');
  return {
    ...originalModule,
    logger: {
      error: jest.fn(),
    },
  };
});

describe('CheckPanel::', () => {
  beforeEach(() => {
    (useSelector as jest.Mock).mockImplementation((callback) => {
      return callback({ perconaUser: { isAuthorized: true }, perconaSettings: { isLoading: false } });
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should show tabs for all checks and for failed checks', async () => {
    const { container } = render(<CheckPanel {...getRouteComponentProps({ match: { params: { tab: '' } } as any })} />);

    expect(container.querySelectorAll('li')[0]).toHaveTextContent(Messages.failedChecksTitle);
    expect(container.querySelectorAll('li')[1]).toHaveTextContent(Messages.allChecksTitle);
  });
});
