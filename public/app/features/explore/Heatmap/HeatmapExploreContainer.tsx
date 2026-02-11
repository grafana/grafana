import { createContext, useMemo } from 'react';

import {
  AbsoluteTimeRange,
  DataLink,
  DataLinksContext,
  DataQuery,
  DataFrame,
  dateTime,
  EventBus,
  Field,
  LoadingState,
  SplitOpen,
  TimeRange,
  TimeZone,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { PanelRenderer } from '@grafana/runtime';
import { TooltipDisplayMode } from '@grafana/schema';

import { useExploreDataLinkPostProcessor } from '../hooks/useExploreDataLinkPostProcessor';

// Context to provide splitOpen function to components that need to manually construct explore links
export const ExploreSplitOpenContext = createContext<{ splitOpen?: SplitOpen; timeRange?: TimeRange }>({});

interface Props {
  data: DataFrame[];
  annotations?: DataFrame[];
  height: number;
  width: number;
  timeRange: TimeRange;
  timeZone: TimeZone;
  loadingState: LoadingState;
  splitOpenFn: SplitOpen;
  datasourceUid: string;
  onChangeTime?: (timeRange: AbsoluteTimeRange) => void;
  eventBus: EventBus;
}

// Helper function to check if two label sets match
const labelsMatch = (labels1?: Record<string, string>, labels2?: Record<string, string>) => {
  if (!labels1 && !labels2) {
    return true;
  }
  if (!labels1 || !labels2) {
    return false;
  }
  const keys1 = Object.keys(labels1);
  const keys2 = Object.keys(labels2);
  if (keys1.length !== keys2.length) {
    return false;
  }
  return keys1.every((key) => labels1[key] === labels2[key]);
};

export function HeatmapExploreContainer({
  data,
  annotations,
  height,
  width,
  timeZone,
  timeRange,
  onChangeTime,
  loadingState,
  splitOpenFn,
  datasourceUid,
  eventBus,
}: Props) {
  const dataLinkPostProcessor = useExploreDataLinkPostProcessor(splitOpenFn, timeRange);

  // Get labels from heatmap's count field
  const heatmapLabels = useMemo(() => {
    return data[0]?.fields.find((f) => f.name === 'count')?.labels;
  }, [data]);

  // Filter annotations to only include matching exemplars
  const filteredAnnotations = useMemo(() => {
    if (!annotations || !heatmapLabels) {
      return annotations;
    }

    return annotations.filter((frame) => {
      if (frame.name !== 'exemplar') {
        return true;
      }
      const valueField = frame.fields.find((f) => f.name === 'Value');
      return labelsMatch(heatmapLabels, valueField?.labels);
    });
  }, [annotations, heatmapLabels]);

  // Configure data links on Span ID fields
  const preparedAnnotations = useMemo(() => {
    if (!filteredAnnotations) {
      return undefined;
    }

    return filteredAnnotations.map((frame) => {
      if (frame.name !== 'exemplar') {
        return frame;
      }

      const newFields = frame.fields.map((field) => {
        if (field.config?.displayName !== 'Span ID') {
          return field;
        }

        interface PyroscopeQuery extends DataQuery {
          queryType: string;
          spanSelector: string[];
          labelSelector: string;
          profileTypeId: string;
          groupBy: string[];
        }

        const dataLink: DataLink<PyroscopeQuery> = {
          title: t('explore.heatmap.view-span-profile', 'View span profile'),
          url: '',
          internal: {
            datasourceUid,
            datasourceName: 'Pyroscope',
            query: (options) => {
              const { scopedVars } = options;
              const rowIndex = scopedVars.__dataContext?.value.rowIndex;

              if (rowIndex === undefined) {
                return {
                  queryType: 'profile',
                  spanSelector: [],
                  labelSelector: '',
                  profileTypeId: '',
                  groupBy: [],
                  refId: 'A',
                };
              }

              const spanId = String(field.values[rowIndex]);
              const profileTypeField = frame.fields.find((f) => f.name === '__profile_type__');
              const profileTypeId = profileTypeField ? String(profileTypeField.values[rowIndex]) : '';

              const labelFields = frame.fields.filter(
                (f) => f.name !== 'Time' && f.name !== 'Value' && f.name !== 'Id' && !f.name.startsWith('__')
              );

              const labelParts = labelFields.map((f) => {
                const value = String(f.values[rowIndex]);
                const name = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(f.name)
                  ? f.name
                  : `"${f.name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
                const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                return `${name}="${escaped}"`;
              });
              const labelSelector = labelParts.length > 0 ? `{${labelParts.join(', ')}}` : '';

              return {
                queryType: 'profile',
                spanSelector: [spanId],
                labelSelector,
                profileTypeId,
                groupBy: [],
                refId: 'A',
              };
            },
          },
          onClick: (event) => {
            event.e?.preventDefault();
            event.e?.stopPropagation();

            if (!splitOpenFn || !event.replaceVariables) {
              return;
            }

            // Extract row index by calling replaceVariables with a dummy template
            // The dataContext should be in the bound scopedVars
            const rowIndexStr = event.replaceVariables('${__dataContext.value.rowIndex}');
            const rowIndex = parseInt(rowIndexStr, 10);

            if (isNaN(rowIndex)) {
              return;
            }

            // Get the time value for this exemplar
            const timeField = frame.fields.find((f) => f.name === 'Time');
            const timeMs = timeField?.values[rowIndex];
            const timestamp = timeMs instanceof Date ? timeMs.getTime() : timeMs;

            // Create +/- 60 second window around the exemplar
            const windowMs = 60 * 1000;
            const fromTime = dateTime(timestamp - windowMs);
            const toTime = dateTime(timestamp + windowMs);

            // Build the query
            const spanId = String(field.values[rowIndex]);
            const profileTypeField = frame.fields.find((f) => f.name === '__profile_type__');
            const profileTypeId = profileTypeField ? String(profileTypeField.values[rowIndex]) : '';

            const labelFields = frame.fields.filter(
              (f) => f.name !== 'Time' && f.name !== 'Value' && f.name !== 'Id' && !f.name.startsWith('__')
            );

            const labelParts = labelFields.map((f) => {
              const value = String(f.values[rowIndex]);
              const name = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(f.name)
                ? f.name
                : `"${f.name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
              const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
              return `${name}="${escaped}"`;
            });
            const labelSelector = labelParts.length > 0 ? `{${labelParts.join(', ')}}` : '';

            const query: PyroscopeQuery = {
              queryType: 'profile',
              spanSelector: [spanId],
              labelSelector,
              profileTypeId,
              groupBy: [],
              refId: 'A',
            };

            // Call splitOpenFn with custom time range
            splitOpenFn({
              datasourceUid,
              queries: [query],
              range: {
                from: fromTime,
                to: toTime,
                raw: { from: fromTime.toISOString(), to: toTime.toISOString() },
              },
            });
          },
        };

        const clonedField: Field = { ...field };
        clonedField.config = {
          ...field.config,
          links: [dataLink],
        };

        return clonedField;
      });

      // Return a new frame with the modified fields
      return {
        ...frame,
        fields: newFields,
      };
    });
  }, [filteredAnnotations, splitOpenFn, datasourceUid, timeZone, timeRange]);

  const panelOptions = useMemo(
    () => ({
      calculate: false, // Data already in heatmap-cells format
      color: {
        scheme: 'Spectral',
        steps: 64,
      },
      tooltip: {
        mode: TooltipDisplayMode.Single,
        yHistogram: true,
        showColorScale: true,
      },
      legend: {
        show: true,
      },
      exemplars: {
        color: 'rgba(31, 120, 193, 0.7)', // Standard Grafana blue to match graph series
      },
    }),
    []
  );

  return (
    <DataLinksContext.Provider value={{ dataLinkPostProcessor }}>
      <ExploreSplitOpenContext.Provider value={{ splitOpen: splitOpenFn, timeRange }}>
        <PanelRenderer
          data={{
            series: data,
            annotations: preparedAnnotations,
            timeRange,
            state: loadingState,
          }}
          pluginId="heatmap"
          title=""
          width={width}
          height={height}
          onChangeTimeRange={onChangeTime}
          timeZone={timeZone}
          options={panelOptions}
        />
      </ExploreSplitOpenContext.Provider>
    </DataLinksContext.Provider>
  );
}
