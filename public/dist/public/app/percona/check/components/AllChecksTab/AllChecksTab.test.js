import { __awaiter } from "tslib";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { locationService } from '@grafana/runtime';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { logger } from 'app/percona/shared/helpers/logger';
import { configureStore } from 'app/store/configureStore';
import { CheckService } from '../../Check.service';
import { AllChecksTab } from './AllChecksTab';
import { Messages } from './AllChecksTab.messages';
jest.mock('app/percona/shared/helpers/logger', () => {
    const originalModule = jest.requireActual('app/percona/shared/helpers/logger');
    return Object.assign(Object.assign({}, originalModule), { logger: {
            error: jest.fn(),
        } });
});
jest.mock('app/percona/check/Check.service');
jest.mock('app/percona/shared/services/advisors/Advisors.service.ts');
describe('AllChecksTab::', () => {
    beforeEach(() => jest.clearAllMocks());
    it('should render a table in category', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(AllChecksTabTesting, null));
        const text = screen.queryByText(/CVE security/i);
        yield waitFor(() => text);
        expect(text).toHaveTextContent(/CVE security/i);
        const collabseDiv = screen.getByTestId('collapse-clickable');
        expect(collabseDiv).toBeInTheDocument();
        yield waitFor(() => fireEvent.click(collabseDiv));
        expect(screen.getByText('MongoDB CVE Version')).toBeInTheDocument();
        expect(screen.getByText('This check returns errors if MongoDB or Percona Server for MongoDB version is less than the latest one with CVE fixes.')).toBeInTheDocument();
    }));
    it('should render a table in different category', () => __awaiter(void 0, void 0, void 0, function* () {
        const navIndex = {
            ['advisors-configuration']: {
                id: 'advisors-configuration',
                text: 'advisors-configuration',
                icon: 'list-ul',
                url: '/advisors/configuration',
            },
        };
        render(React.createElement(Provider, { store: configureStore({
                percona: {
                    user: { isAuthorized: true, isPlatformUser: false },
                    settings: { result: { sttEnabled: true, isConnectedToPortal: false } },
                    advisors: {
                        loading: false,
                        result: advisorsArray,
                    },
                },
                navIndex: navIndex,
            }) },
            React.createElement(Router, { history: locationService.getHistory() },
                React.createElement(AllChecksTab, Object.assign({}, getRouteComponentProps({
                    match: {
                        params: { category: 'configuration' },
                        isExact: true,
                        path: '/advisors/:category',
                        url: '/advisors/configuration',
                    },
                }))))));
        const text = screen.queryByText(/Version configuration/i);
        yield waitFor(() => text);
        expect(text).toHaveTextContent(/Version configuration/i);
        const collabseDiv = screen.getByTestId('collapse-clickable');
        expect(collabseDiv).toBeInTheDocument();
        yield waitFor(() => fireEvent.click(collabseDiv));
        expect(screen.getByText('PostgreSQL Version')).toBeInTheDocument();
        expect(screen.getByText('MySQL Version')).toBeInTheDocument();
    }));
    it('should call an API to change the check status when the action button gets clicked', () => __awaiter(void 0, void 0, void 0, function* () {
        let runChecksSpy = jest.spyOn(CheckService, 'changeCheck');
        render(React.createElement(AllChecksTabTesting, null));
        const text = screen.queryByText(/CVE security/i);
        yield waitFor(() => text);
        expect(text).toHaveTextContent(/CVE security/i);
        const collabseDiv = screen.getByTestId('collapse-clickable');
        expect(collabseDiv).toBeInTheDocument();
        yield waitFor(() => fireEvent.click(collabseDiv));
        const button = screen.getAllByTestId('check-table-loader-button')[0];
        expect(button).toBeInTheDocument();
        yield waitFor(() => fireEvent.click(button));
        expect(runChecksSpy).toBeCalledTimes(1);
        expect(runChecksSpy).toBeCalledWith({ params: [{ name: 'mongodb_cve_version', disable: true }] });
    }));
    it('should log an error if the run checks API call fails', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(CheckService, 'runDbChecks').mockImplementationOnce(() => {
            throw Error('test');
        });
        const loggerSpy = jest.spyOn(logger, 'error');
        render(React.createElement(AllChecksTabTesting, null));
        const text = screen.queryByText(/CVE security/i);
        yield waitFor(() => text);
        expect(text).toHaveTextContent(/CVE security/i);
        const runChecksButton = screen.getByRole('button', { name: Messages.runDbChecks });
        yield waitFor(() => fireEvent.click(runChecksButton));
        yield waitFor(() => {
            expect(loggerSpy).toBeCalledTimes(1);
        });
        expect(yield screen.findByText('Run Checks')).toBeInTheDocument();
    }));
    it('should call the API to run checks when the "run checks" button gets clicked', () => __awaiter(void 0, void 0, void 0, function* () {
        let runChecksSpy = jest.spyOn(CheckService, 'runDbChecks').mockImplementation(() => __awaiter(void 0, void 0, void 0, function* () { return ({}); }));
        render(React.createElement(AllChecksTabTesting, null));
        const text = screen.queryByText(/CVE security/i);
        yield waitFor(() => text);
        expect(text).toHaveTextContent(/CVE security/i);
        const runChecksButton = screen.getByRole('button', { name: Messages.runDbChecks });
        expect(runChecksButton).toBeInTheDocument();
        expect(runChecksSpy).toBeCalledTimes(0);
        yield waitFor(() => {
            fireEvent.click(runChecksButton);
        });
        yield waitFor(() => {
            expect(runChecksSpy).toBeCalledTimes(1);
        });
    }));
});
const AllChecksTabTesting = () => {
    return (React.createElement(Provider, { store: configureStore({
            percona: {
                user: { isAuthorized: true, isPlatformUser: false },
                settings: { result: { sttEnabled: true, isConnectedToPortal: false } },
                advisors: {
                    loading: false,
                    result: advisorsArray,
                },
            },
            navIndex: navIndex,
        }) },
        React.createElement(Router, { history: locationService.getHistory() },
            React.createElement(AllChecksTab, Object.assign({}, getRouteComponentProps({
                match: {
                    params: { category: 'security' },
                    isExact: true,
                    path: '/advisors/:category',
                    url: '/advisors/security',
                },
            }))))));
};
const navIndex = {
    ['advisors-security']: {
        id: 'advisors-security',
        text: 'advisors-security',
        icon: 'list-ul',
        url: '/advisors/security',
    },
};
const advisorsArray = [
    {
        name: 'cve_security',
        description: 'Informing users about versions of DBs  affected by CVE.',
        summary: 'CVE security',
        category: 'security',
        checks: [
            {
                name: 'mongodb_cve_version',
                description: 'This check returns errors if MongoDB or Percona Server for MongoDB version is less than the latest one with CVE fixes.',
                summary: 'MongoDB CVE Version',
                interval: 'RARE',
            },
        ],
    },
    {
        name: 'version_configuration',
        description: 'Informs users about new versions of database released to simplify the process of keeping your DB up to date.',
        summary: 'Version configuration',
        category: 'configuration',
        checks: [
            {
                name: 'mongodb_version',
                disabled: true,
                description: 'This check returns warnings if MongoDB or Percona Server for MongoDB version is not the latest one.',
                summary: 'MongoDB Version',
                interval: 'FREQUENT',
            },
            {
                name: 'mysql_version',
                disabled: true,
                description: 'This check returns warnings if MySQL, Percona Server for MySQL, or MariaDB version is not the latest one.',
                summary: 'MySQL Version',
                interval: 'RARE',
            },
            {
                name: 'postgresql_version',
                description: 'This check returns warnings if PostgreSQL minor version is not the latest one.\nAdditionally notice is returned if PostgreSQL major version is not the latest one.\nError is returned if the major version of PostgreSQL is 9.4 or older.\n',
                summary: 'PostgreSQL Version',
                interval: 'STANDARD',
            },
        ],
    },
];
//# sourceMappingURL=AllChecksTab.test.js.map