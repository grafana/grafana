import { render, screen, waitFor } from '@testing-library/react';

import { DataSourceInstanceSettings, DataSourceSettings } from '@grafana/data';
import { DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';

import { TraceToProfilesData, TraceToProfilesSettings } from './TraceToProfilesSettings';

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
