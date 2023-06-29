import { render, screen } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';

import { setDataSourceSrv } from '@grafana/runtime';
import { MockDataSourceSrv } from 'app/features/alerting/unified/mocks';

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
};

describe('QueryEditorField', () => {
  afterAll(() => {
    jest.restoreAllMocks();
  });

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

    expect(await screen.findByRole('status', { name: 'No data source selected' })).toBeInTheDocument();
  });

  it('shows an info alert when datasaource does not export a query editor', async () => {
    renderWithContext(<QueryEditorField name="query" dsUid="something" />, async (name) => {
      return new MockDataSourceApi(name);
    });

    expect(
      await screen.findByRole('alert', { name: 'Data source does not export a query editor.' })
    ).toBeInTheDocument();
  });
});
