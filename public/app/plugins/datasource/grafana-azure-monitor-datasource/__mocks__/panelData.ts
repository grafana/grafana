import { PanelData } from '@grafana/data';

type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

export default function createMockPanelData() {
  const _mockPanelData: DeepPartial<PanelData> = {};

  const mockPanelData = _mockPanelData as PanelData;

  return jest.mocked(mockPanelData, true);
}
