import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DataSourceInstanceSettings, DataSourcePluginMeta } from '@grafana/data';

import { PrometheusDatasource } from '../../../datasource';
import PromQlLanguageProvider from '../../../language_provider';
import { EmptyLanguageProviderMock } from '../../../language_provider.mock';
import { PromOptions } from '../../../types';
import { PromVisualQuery } from '../../types';

import { PromQail, testIds } from './PromQail';

// don't care about interaction tracking in our unit tests
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

window.HTMLElement.prototype.scrollIntoView = jest.fn();

describe('PromQail', () => {
  it('renders the drawer', async () => {
    setup(defaultQuery);
    await waitFor(() => {
      expect(screen.getByText('Query advisor')).toBeInTheDocument();
    });
  });

  it('shows an option to not show security warning', async () => {
    setup(defaultQuery);
    await waitFor(() => {
      expect(screen.getByText("Don't show this message again")).toBeInTheDocument();
    });
  });

  it('shows selected metric and asks for a prompt', async () => {
    setup(defaultQuery);

    clickSecurityButton();

    await waitFor(() => {
      expect(screen.getByText('random_metric')).toBeInTheDocument();
      expect(screen.getByText('Do you know what you want to query?')).toBeInTheDocument();
    });
  });

  it('displays a prompt when the user knows what they want to query', async () => {
    setup(defaultQuery);

    clickSecurityButton();

    await waitFor(() => {
      expect(screen.getByText('random_metric')).toBeInTheDocument();
      expect(screen.getByText('Do you know what you want to query?')).toBeInTheDocument();
    });

    const aiPrompt = screen.getByTestId(testIds.clickForAi);

    userEvent.click(aiPrompt);

    await waitFor(() => {
      expect(screen.getByText('What kind of data do you want to see with your metric?')).toBeInTheDocument();
    });
  });

  it('does not display a prompt when choosing historical', async () => {
    setup(defaultQuery);

    clickSecurityButton();

    await waitFor(() => {
      expect(screen.getByText('random_metric')).toBeInTheDocument();
      expect(screen.getByText('Do you know what you want to query?')).toBeInTheDocument();
    });

    const historicalPrompt = screen.getByTestId(testIds.clickForHistorical);

    userEvent.click(historicalPrompt);

    await waitFor(() => {
      expect(screen.queryByText('What kind of data do you want to see with your metric?')).toBeNull();
    });
  });
});

const defaultQuery: PromVisualQuery = {
  metric: 'random_metric',
  labels: [],
  operations: [],
};

function createDatasource(withLabels?: boolean) {
  const languageProvider = new EmptyLanguageProviderMock() as unknown as PromQlLanguageProvider;

  languageProvider.metricsMetadata = {
    'all-metrics': {
      type: 'all-metrics-type',
      help: 'all-metrics-help',
    },
    a: {
      type: 'counter',
      help: 'a-metric-help',
    },
    a_bucket: {
      type: 'counter',
      help: 'for functions',
    },
  };

  const datasource = new PrometheusDatasource(
    {
      url: '',
      jsonData: {},
      meta: {} as DataSourcePluginMeta,
    } as DataSourceInstanceSettings<PromOptions>,
    undefined,
    languageProvider
  );
  return datasource;
}

function createProps(query: PromVisualQuery, datasource: PrometheusDatasource) {
  return {
    datasource,
    onChange: jest.fn(),
    closeDrawer: jest.fn(),
    query: query,
  };
}

function setup(query: PromVisualQuery) {
  const withLabels: boolean = query.labels.length > 0;
  const datasource = createDatasource(withLabels);
  const props = createProps(query, datasource);

  // render the drawer only
  const { container } = render(<PromQail {...props} />);

  return container;
}

function clickSecurityButton() {
  const securityInfoButton = screen.getByTestId(testIds.securityInfoButton);

  userEvent.click(securityInfoButton);
}
