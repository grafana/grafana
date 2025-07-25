import { createContext, ItemDataType } from '@grafana/assistant';
import { DataFrame } from '@grafana/data';

export function getAssistantContextFromDataFrame(data: DataFrame) {
  return [
    createContext(ItemDataType.Datasource, {
      datasourceName: 'gdev-pyroscope',
      datasourceUid: 'gdev-pyroscope',
      datasourceType: 'grafana-pyroscope-datasource',
    }),
    createContext(ItemDataType.Structured, {
      title: 'Analyze Flame Graph2',
      data: {
        start: 1753427801470,
        end: 1753431401470,
        profile_type_id: 'process_cpu:cpu:nanoseconds:cpu:nanoseconds',
        label_selector: `{service_name="pyroscope2"}`,
        operation: 'execute',
      },
    }),
  ];
}
