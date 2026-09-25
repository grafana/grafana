import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { type DataSourceInstanceSettings } from '@grafana/data';
import { setTemplateSrv } from '@grafana/runtime';
import { useDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { ConfigureCorrelationSourceForm } from './ConfigureCorrelationSourceForm';
import { type FormDTO } from './types';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  useDataSourceInstanceSettings: jest.fn(),
}));

// The picker resolves the whole data source list through the srv singleton, which
// is unrelated to the heading these tests cover.
jest.mock('app/features/datasources/components/picker/DataSourcePicker', () => ({
  DataSourcePicker: () => <div />,
}));

const useDataSourceInstanceSettingsMock = jest.mocked(useDataSourceInstanceSettings);

const Wrapper = ({ children }: { children: ReactNode }) => {
  const methods = useForm<FormDTO>({
    defaultValues: { type: 'query', targetUID: 'target-uid', config: { target: {}, field: '' } },
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

const renderForm = () =>
  render(
    <Wrapper>
      <ConfigureCorrelationSourceForm />
    </Wrapper>
  );

describe('ConfigureCorrelationSourceForm', () => {
  beforeAll(() => {
    // The form scans the target query for template variables on every render.
    setTemplateSrv(new TemplateSrv());
  });

  afterEach(() => {
    useDataSourceInstanceSettingsMock.mockReset();
  });

  it('names the target data source in the heading once it resolves', () => {
    useDataSourceInstanceSettingsMock.mockReturnValue({
      isLoading: false,
      settings: { name: 'Loki' } as DataSourceInstanceSettings,
    });

    renderForm();

    expect(useDataSourceInstanceSettingsMock).toHaveBeenCalledWith('target-uid');
    expect(
      screen.getByRole('group', { name: 'Configure the data source that will link to Loki (Step 3 of 3)' })
    ).toBeInTheDocument();
  });

  it('omits the name from the heading while the target data source is loading', () => {
    useDataSourceInstanceSettingsMock.mockReturnValue({ isLoading: true, settings: undefined });

    renderForm();

    expect(
      screen.getByRole('group', { name: 'Configure the data source that will link to (Step 3 of 3)' })
    ).toBeInTheDocument();
  });

  it('omits the name from the heading when the targetUID does not resolve', () => {
    useDataSourceInstanceSettingsMock.mockReturnValue({ isLoading: false, settings: undefined });

    renderForm();

    expect(
      screen.getByRole('group', { name: 'Configure the data source that will link to (Step 3 of 3)' })
    ).toBeInTheDocument();
  });
});
