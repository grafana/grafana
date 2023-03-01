import { FieldType, LoadingState, PanelData } from '@grafana/data';

type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

export default function createMockPanelData(overrides?: DeepPartial<PanelData>) {
  const _mockPanelData: DeepPartial<PanelData> = {
    state: 'Loading' as LoadingState,
    series: [
      {
        refId: 'A',
        fields: [
          {
            name: 'Time',
            type: 'time' as FieldType,
            config: { links: Array(1) },
            values: [],
            state: null,
          },
        ],
        length: 360,
      },
    ],
    annotations: [],
    request: {
      app: 'dashboard',
      requestId: 'request',
      timezone: 'browser',
      panelId: 1,
      dashboardId: 0,
      timeInfo: '',
      interval: '20s',
      intervalMs: 20000,
      targets: [],
      maxDataPoints: 100,
      rangeRaw: {
        from: 'now-6h',
        to: 'now',
      },
    },

    structureRev: 15,
    ...overrides,
  };

  const mockPanelData = _mockPanelData as PanelData;

  return jest.mocked(mockPanelData);
}
