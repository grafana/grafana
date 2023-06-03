import { renderHook } from '@testing-library/react-hooks';

import { getMockDS, getMockDSInstanceSettings, mockBackendService } from '../../../../../specs/mocks';

import { useAllMeasurementsForTags } from './useAllMeasurementsForTags';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
}));

describe('useAllMeasurementsForTags', () => {
  it('should return all measurements', async () => {
    const instanceSettings = getMockDSInstanceSettings();
    const datasource = getMockDS(instanceSettings);
    mockBackendService(response);

    const { result, waitForNextUpdate } = renderHook(() => useAllMeasurementsForTags(datasource));
    result.current.getAllMeasurementsForTags([]);
    await waitForNextUpdate();
    expect(result.current.allMeasurements.length).toEqual(4);
    expect(result.current.allMeasurements[0]).toEqual('cpu');
  });
});

const response = {
  data: {
    results: {
      metadataQuery: {
        status: 200,
        frames: [
          {
            schema: {
              name: 'measurements',
              refId: 'metadataQuery',
              fields: [{ name: 'value', type: 'string', typeInfo: { frame: 'string' } }],
            },
            data: {
              values: [['cpu', 'derivative', 't_swap', 't_system']],
            },
          },
        ],
      },
    },
  },
};
