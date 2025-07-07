import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FC } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom-v5-compat';

import { NavIndex, OrgRole } from '@grafana/data';
import { config } from '@grafana/runtime';
import { logger } from 'app/percona/shared/helpers/logger';
import { wrapWithGrafanaContextMock } from 'app/percona/shared/helpers/testUtils';
import { Advisor } from 'app/percona/shared/services/advisors/Advisors.types';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import { CheckService } from '../../Check.service';

import { AllChecksTab } from './AllChecksTab';
import { Messages } from './AllChecksTab.messages';

jest.mock('app/percona/shared/helpers/logger', () => {
  const originalModule = jest.requireActual('app/percona/shared/helpers/logger');
  return {
    ...originalModule,
    logger: {
      error: jest.fn(),
    },
  };
});
jest.mock('app/percona/check/Check.service');
jest.mock('app/percona/shared/services/advisors/Advisors.service.ts');

describe('AllChecksTab::', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    config.bootData.user.isGrafanaAdmin = true;
    config.bootData.user.orgRole = OrgRole.Admin;
  });

  it('should render a table in category', async () => {
    render(<AllChecksTabTesting />);

    const text = screen.queryByText(/CVE security/i);

    await waitFor(() => text);

    expect(text).toHaveTextContent(/CVE security/i);

    const collabseDiv = screen.getByTestId('collapse-clickable');

    expect(collabseDiv).toBeInTheDocument();

    await waitFor(() => fireEvent.click(collabseDiv));

    expect(screen.getByText('MongoDB CVE Version')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This check returns errors if MongoDB or Percona Server for MongoDB version is less than the latest one with CVE fixes.'
      )
    ).toBeInTheDocument();
  });

  it('should render a table in different category', async () => {
    render(<AllChecksTabTesting category="configuration" />);

    const text = screen.queryByText(/Version configuration/i);

    await waitFor(() => text);

    expect(text).toHaveTextContent(/Version configuration/i);

    const collabseDiv = screen.getByTestId('collapse-clickable');

    expect(collabseDiv).toBeInTheDocument();

    await waitFor(() => fireEvent.click(collabseDiv));

    expect(screen.getByText('PostgreSQL Version')).toBeInTheDocument();
    expect(screen.getByText('MySQL Version')).toBeInTheDocument();
  });

  it('should call an API to change the check status when the action button gets clicked', async () => {
    let runChecksSpy = jest.spyOn(CheckService, 'changeCheck');
    render(<AllChecksTabTesting />);

    const text = screen.queryByText(/CVE security/i);

    await waitFor(() => text);

    expect(text).toHaveTextContent(/CVE security/i);

    const collabseDiv = screen.getByTestId('collapse-clickable');

    expect(collabseDiv).toBeInTheDocument();

    await waitFor(() => fireEvent.click(collabseDiv));

    const button = screen.getAllByTestId('check-table-loader-button')[0];
    expect(button).toBeInTheDocument();

    await waitFor(() => fireEvent.click(button));

    expect(runChecksSpy).toBeCalledTimes(1);
    expect(runChecksSpy).toBeCalledWith({ params: [{ name: 'mongodb_cve_version', enable: false }] });
  });

  it('should log an error if the run checks API call fails', async () => {
    jest.spyOn(CheckService, 'runDbChecks').mockImplementationOnce(() => {
      throw Error('test');
    });
    const loggerSpy = jest.spyOn(logger, 'error');

    render(<AllChecksTabTesting />);

    const text = screen.queryByText(/CVE security/i);

    await waitFor(() => text);

    expect(text).toHaveTextContent(/CVE security/i);

    const runChecksButton = screen.getByRole('button', { name: Messages.runDbChecks });

    await waitFor(() => fireEvent.click(runChecksButton));

    await waitFor(() => {
      expect(loggerSpy).toBeCalledTimes(1);
    });

    expect(await screen.findByText('Run Checks')).toBeInTheDocument();
  });

  it('should call the API to run checks when the "run checks" button gets clicked', async () => {
    let runChecksSpy = jest.spyOn(CheckService, 'runDbChecks').mockImplementation(async () => ({}));

    render(<AllChecksTabTesting />);

    const text = screen.queryByText(/CVE security/i);

    await waitFor(() => text);

    expect(text).toHaveTextContent(/CVE security/i);

    const runChecksButton = screen.getByRole('button', { name: Messages.runDbChecks });

    expect(runChecksButton).toBeInTheDocument();
    expect(runChecksSpy).toBeCalledTimes(0);

    await waitFor(() => {
      fireEvent.click(runChecksButton);
    });

    await waitFor(() => {
      expect(runChecksSpy).toBeCalledTimes(1);
    });
  });

  it("editors shouldn't be able to run advisor checks", async () => {
    config.bootData.user.isGrafanaAdmin = false;
    config.bootData.user.orgRole = OrgRole.Editor;

    render(<AllChecksTabTesting />);

    const runChecksButton = screen.queryByRole('button', { name: Messages.runDbChecks });

    expect(runChecksButton).toBeNull();
  });

  it('editors should be able to run checks', () => {
    config.bootData.user.isGrafanaAdmin = false;
    config.bootData.user.orgRole = OrgRole.Editor;

    render(<AllChecksTabTesting />);

    expect(screen.queryByTestId('db-check-panel-actions')).not.toBeInTheDocument();
  });

  it("viewers shouldn't be able to to access advisors", async () => {
    config.bootData.user.isGrafanaAdmin = false;
    config.bootData.user.orgRole = OrgRole.Editor;

    render(<AllChecksTabTesting />);

    expect(screen.queryByText('Insufficient access permissions.'));
  });
});

const AllChecksTabTesting: FC<{ category?: string }> = ({ category = 'security' }) => (
  <Provider
    store={configureStore({
      percona: {
        user: { isAuthorized: true, isPlatformUser: false },
        settings: { result: { advisorEnabled: true, isConnectedToPortal: false } },
        advisors: {
          loading: false,
          result: advisorsArray,
        },
      },
      navIndex: navIndex,
    } as StoreState)}
  >
    {wrapWithGrafanaContextMock(
      <MemoryRouter initialEntries={['/advisors/' + category]}>
        <Routes>
          <Route path="/advisors/:category" element={<AllChecksTab />} />
        </Routes>
      </MemoryRouter>
    )}
  </Provider>
);

const navIndex: NavIndex = {
  ['advisors-security']: {
    id: 'advisors-security',
    text: 'advisors-security',
    icon: 'list-ul',
    url: '/advisors/security',
  },
};

const advisorsArray: Advisor[] = [
  {
    name: 'cve_security',
    description: 'Informing users about versions of DBs  affected by CVE.',
    summary: 'CVE security',
    category: 'security',
    checks: [
      {
        name: 'mongodb_cve_version',
        description:
          'This check returns errors if MongoDB or Percona Server for MongoDB version is less than the latest one with CVE fixes.',
        summary: 'MongoDB CVE Version',
        interval: 'RARE',
        enabled: true,
      },
    ],
    comment: '',
  },
  {
    name: 'version_configuration',
    description:
      'Informs users about new versions of database released to simplify the process of keeping your DB up to date.',
    summary: 'Version configuration',
    category: 'configuration',
    checks: [
      {
        name: 'mongodb_version',
        enabled: false,
        description:
          'This check returns warnings if MongoDB or Percona Server for MongoDB version is not the latest one.',
        summary: 'MongoDB Version',
        interval: 'FREQUENT',
      },
      {
        name: 'mysql_version',
        enabled: false,
        description:
          'This check returns warnings if MySQL, Percona Server for MySQL, or MariaDB version is not the latest one.',
        summary: 'MySQL Version',
        interval: 'RARE',
      },
      {
        name: 'postgresql_version',
        description:
          'This check returns warnings if PostgreSQL minor version is not the latest one.\nAdditionally notice is returned if PostgreSQL major version is not the latest one.\nError is returned if the major version of PostgreSQL is 9.4 or older.\n',
        summary: 'PostgreSQL Version',
        interval: 'STANDARD',
        enabled: true,
      },
    ],
    comment: '',
  },
];
