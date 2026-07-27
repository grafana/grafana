// Copied from https://github.com/grafana/grafana-tempo-datasource — the Tempo datasource was removed
// from core and moved to an external repo.
import { type DataSourceInstanceSettings, type DataSourceJsonData, PluginType } from '@grafana/data';

export interface TempoJsonData extends DataSourceJsonData {
  tracesToLogs?: unknown;
  serviceMap?: {
    datasourceUid?: string;
  };
  search?: {
    hide?: boolean;
    filters?: unknown[];
  };
  nodeGraph?: unknown;
  spanBar?: {
    tag: string;
  };
  tagLimit?: number;
  traceQuery?: {
    timeShiftEnabled?: boolean;
    spanStartTimeShift?: string;
    spanEndTimeShift?: string;
  };
  streamingEnabled?: {
    search?: boolean;
  };
  timeRangeForTags?: number;
}

const defaultMeta = {
  id: 'id',
  name: 'name',
  type: PluginType.datasource,
  module: '',
  baseUrl: '',
  info: {
    author: { name: 'Test' },
    description: '',
    links: [],
    logos: { large: '', small: '' },
    screenshots: [],
    updated: '',
    version: '',
  },
};

export type TempoDatasource = ReturnType<typeof createTempoDatasource>;

export function createTempoDatasource(
  _templateSrv?: unknown,
  settings: Partial<DataSourceInstanceSettings<TempoJsonData>> = {}
) {
  const customSettings: DataSourceInstanceSettings<TempoJsonData> = {
    url: 'myloggingurl',
    uid: '',
    type: 'tempo',
    name: 'Tempo',
    meta: defaultMeta,
    readOnly: false,
    jsonData: {},
    access: 'direct',
    ...settings,
  };

  return {
    uid: customSettings.uid,
    name: customSettings.name,
    type: customSettings.type,
    meta: customSettings.meta,
    instanceSettings: customSettings,
    query: jest.fn().mockReturnValue({ subscribe: jest.fn() }),
    testDatasource: jest.fn().mockResolvedValue({ status: 'success', message: 'OK' }),
    getTagKeys: jest.fn().mockResolvedValue([]),
    getTagValues: jest.fn().mockResolvedValue([]),
  };
}
