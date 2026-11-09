import { render, screen, waitFor } from '@testing-library/react';

import { type DataSourceApi, type DataSourceInstanceSettings, type DataSourceSettings } from '@grafana/data';
import { useDataSourceInstance } from '@grafana/plugin-compat/datasources';
import { type DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';

import { type TraceToProfilesData, TraceToProfilesSettings } from './TraceToProfilesSettings';

jest.mock('@grafana/plugin-compat/datasources', () => ({
  ...jest.requireActual('@grafana/plugin-compat/datasources'),
  useDataSourceInstance: jest.fn(),
}));

const defaultOption: DataSourceSettings<TraceToProfilesData> = {
  jsonData: {
    tracesToProfiles: {
      datasourceUid: 'profiling1_uid',
      tags: [{ key: 'someTag', value: 'newName' }],
      customQuery: true,
      query: '{${__tags}}',
    },
  },
} as unknown as DataSourceSettings<TraceToProfilesData>;

const pyroSettings = {
  uid: 'profiling1_uid',
  name: 'profiling1',
  type: 'grafana-pyroscope-datasource',
  meta: { info: { logos: { small: '' } } },
} as unknown as DataSourceInstanceSettings;

describe('TraceToProfilesSettings', () => {
  beforeAll(() => {
    setDataSourceSrv({
      getList() {
        return [pyroSettings];
      },
      getInstanceSettings() {
        return pyroSettings;
      },
    } as unknown as DataSourceSrv);
    jest
      .mocked(useDataSourceInstance)
      .mockReturnValue({ isLoading: false, dataSource: pyroSettings as unknown as DataSourceApi });
  });

  it('should render without error', () => {
    waitFor(() => {
      expect(() =>
        render(<TraceToProfilesSettings options={defaultOption} onOptionsChange={() => {}} />)
      ).not.toThrow();
    });
  });

  it('should render all options', () => {
    render(<TraceToProfilesSettings options={defaultOption} onOptionsChange={() => {}} />);
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('Profile type')).toBeInTheDocument();
    expect(screen.getByText('Use custom query')).toBeInTheDocument();
  });
});
