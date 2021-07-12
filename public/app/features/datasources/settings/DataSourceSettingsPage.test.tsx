import React from 'react';
import { DataSourceSettingsPage, Props } from './DataSourceSettingsPage';
import { getMockDataSource } from '../__mocks__/dataSourcesMocks';
import { getMockPlugin } from '../../plugins/__mocks__/pluginMocks';
import { dataSourceLoaded, setDataSourceName, setIsDefault } from '../state/reducers';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { cleanUpAction } from 'app/core/actions/cleanUp';
import { screen, render } from '@testing-library/react';
import { selectors } from '@grafana/e2e-selectors';
import { PluginState } from '@grafana/data';

const getMockNode = () => ({
  text: 'text',
  subTitle: 'subtitle',
  icon: 'icon',
});

const getProps = (): Props => ({
  ...getRouteComponentProps(),
  navModel: {
    node: getMockNode(),
    main: getMockNode(),
  },
  dataSource: getMockDataSource(),
  dataSourceMeta: getMockPlugin(),
  dataSourceId: 'x',
  deleteDataSource: jest.fn(),
  loadDataSource: jest.fn(),
  setDataSourceName,
  updateDataSource: jest.fn(),
  initDataSourceSettings: jest.fn(),
  testDataSource: jest.fn(),
  setIsDefault,
  dataSourceLoaded,
  cleanUpAction,
  page: null,
  plugin: null,
  loadError: null,
  testingStatus: {},
});

describe('Render', () => {
  it('should not render loading when props are ready', () => {
    render(<DataSourceSettingsPage {...getProps()} />);

    expect(screen.queryByText('Loading ...')).not.toBeInTheDocument();
  });

  it('should render loading if datasource is not ready', () => {
    const mockProps = getProps();
    mockProps.dataSource.id = 0;

    render(<DataSourceSettingsPage {...mockProps} />);

    expect(screen.getByText('Loading ...')).toBeInTheDocument();
  });

  it('should render beta info text if plugin state is beta', () => {
    const mockProps = getProps();
    mockProps.dataSourceMeta.state = PluginState.beta;

    render(<DataSourceSettingsPage {...mockProps} />);

    expect(screen.getByTitle('This feature is close to complete but not fully tested')).toBeInTheDocument();
  });

  it('should render alpha info text if plugin state is alpha', () => {
    const mockProps = getProps();
    mockProps.dataSourceMeta.state = PluginState.alpha;

    render(<DataSourceSettingsPage {...mockProps} />);

    expect(
      screen.getByTitle('This feature is experimental and future updates might not be backward compatible')
    ).toBeInTheDocument();
  });

  it('should not render is ready only message is readOnly is false', () => {
    const mockProps = getProps();
    mockProps.dataSource.readOnly = false;

    render(<DataSourceSettingsPage {...mockProps} />);

    expect(screen.queryByLabelText(selectors.pages.DataSource.readOnly)).not.toBeInTheDocument();
  });

  it('should render is ready only message is readOnly is true', () => {
    const mockProps = getProps();
    mockProps.dataSource.readOnly = true;

    render(<DataSourceSettingsPage {...mockProps} />);

    expect(screen.getByLabelText(selectors.pages.DataSource.readOnly)).toBeInTheDocument();
  });

  it('should render error message with detailed message', () => {
    const mockProps = {
      ...getProps(),
      testingStatus: {
        message: 'message',
        status: 'error',
        details: { message: 'detailed message' },
      },
    };

    render(<DataSourceSettingsPage {...mockProps} />);

    expect(screen.getByText(mockProps.testingStatus.message)).toBeInTheDocument();
    expect(screen.getByText(mockProps.testingStatus.details.message)).toBeInTheDocument();
  });

  it('should render error message with empty details', () => {
    const mockProps = {
      ...getProps(),
      testingStatus: {
        message: 'message',
        status: 'error',
        details: {},
      },
    };

    render(<DataSourceSettingsPage {...mockProps} />);

    expect(screen.getByText(mockProps.testingStatus.message)).toBeInTheDocument();
  });

  it('should render error message without details', () => {
    const mockProps = {
      ...getProps(),
      testingStatus: {
        message: 'message',
        status: 'error',
      },
    };

    render(<DataSourceSettingsPage {...mockProps} />);

    expect(screen.getByText(mockProps.testingStatus.message)).toBeInTheDocument();
  });

  it('should render verbose error message with detailed verbose error message', () => {
    const mockProps = {
      ...getProps(),
      testingStatus: {
        message: 'message',
        status: 'error',
        details: { message: 'detailed message', verboseMessage: 'verbose message' },
      },
    };

    render(<DataSourceSettingsPage {...mockProps} />);

    expect(screen.getByText(mockProps.testingStatus.details.verboseMessage)).toBeInTheDocument();
  });
});
