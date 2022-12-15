import { fireEvent, render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';

import { LoadingState } from '@grafana/data';
import { setDataSourceSrv, setQueryRunnerFactory } from '@grafana/runtime';
import { MockDataSourceSrv } from 'app/features/alerting/unified/mocks';

import { QueryRunner } from '../../query/state/QueryRunner';

import { QueryEditorField } from './QueryEditorField';

const Wrapper = ({ children }: { children: ReactNode }) => {
  const methods = useForm({ defaultValues: { query: {} } });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

const defaultGetHandler = async (name: string) => {
  const dsApi = new MockDataSourceApi(name);
  dsApi.components = {
    QueryEditor: () => <>{name} query editor</>,
  };
  return dsApi;
};

const renderWithContext = (
  children: ReactNode,
  getHandler: (name: string) => Promise<MockDataSourceApi> = defaultGetHandler
) => {
  const dsServer = new MockDataSourceSrv({});
  dsServer.get = getHandler;

  setDataSourceSrv(dsServer);

  render(<Wrapper>{children}</Wrapper>);

  return dsServer.get;
};

describe('QueryEditorField', () => {
  it('should render the query editor', async () => {
    renderWithContext(<QueryEditorField name="query" dsUid="test" />);

    expect(await screen.findByText('test query editor')).toBeInTheDocument();
  });

  it("shows an error alert when datasource can't be loaded", async () => {
    renderWithContext(<QueryEditorField name="query" dsUid="something" />, () => {
      throw new Error('Unable to load datasource');
    });

    expect(await screen.findByRole('alert', { name: 'Error loading data source' })).toBeInTheDocument();
  });

  it('shows an info alert when no datasource is selected', async () => {
    renderWithContext(<QueryEditorField name="query" />);

    expect(await screen.findByRole('alert', { name: 'No data source selected' })).toBeInTheDocument();
  });

  it('shows an info alert when datasaource does not export a query editor', async () => {
    renderWithContext(<QueryEditorField name="query" dsUid="something" />, async (name) => {
      return new MockDataSourceApi(name);
    });

    expect(
      await screen.findByRole('alert', { name: 'Data source does not export a query editor.' })
    ).toBeInTheDocument();
  });

  describe('query validation', () => {
    beforeEach(() => {
      // Request errors cause the query runner to print to console,
      // this means the test would fail because of the fail on log rules.
      // We mock console.error to avoid this.
      jest.spyOn(console, 'error').mockImplementation();
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it('should validate when the query is valid', async () => {
      const dsApi = new MockDataSourceApi('something');
      dsApi.components = {
        QueryEditor: () => <>query editor</>,
      };

      renderWithContext(<QueryEditorField name="query" dsUid="something" />, async () => {
        return dsApi;
      });

      await waitForElementToBeRemoved(() => screen.queryByText(/loading query editor/i));

      // Request errors should result in failed validation
      dsApi.error = 'Some error';
      fireEvent.click(screen.getByRole('button', { name: /Validate query$/i }));
      await waitFor(() => {
        const alertEl = screen.getByRole('alert');
        expect(alertEl).toBeInTheDocument();
        expect(alertEl).toHaveTextContent(/this query is not valid/i);
      });
      dsApi.error = null;

      // Results with data should be valid
      dsApi.result = {
        data: [
          {
            name: 'test',
            fields: [],
            length: 0,
          },
        ],
        state: LoadingState.Done,
      };
      fireEvent.click(screen.getByRole('button', { name: /Validate query$/i }));

      await waitFor(() => {
        expect(screen.getByText('This query is valid.')).toBeInTheDocument();
      });

      // results with error should be invalid, even when they have data
      dsApi.result = {
        data: [],
        state: LoadingState.Error,
      };
      fireEvent.click(screen.getByRole('button', { name: /Validate query$/i }));
      await waitFor(() => {
        const alertEl = screen.getByRole('alert');
        expect(alertEl).toBeInTheDocument();
        expect(alertEl).toHaveTextContent(/this query is not valid/i);
      });

      dsApi.result = {
        data: [
          {
            name: 'test',
            fields: [],
            length: 0,
          },
        ],
        state: LoadingState.Error,
      };
      fireEvent.click(screen.getByRole('button', { name: /Validate query$/i }));
      await waitFor(() => {
        const alertEl = screen.getByRole('alert');
        expect(alertEl).toBeInTheDocument();
        expect(alertEl).toHaveTextContent(/this query is not valid/i);
      });
    });
  });
});
