import { isEqual } from 'lodash';
import { lastValueFrom } from 'rxjs';

import { CorrelationSpec } from '@grafana/api-clients/rtkq/correlations/v0alpha1';
import { DataFrame, DataLinkConfigOrigin } from '@grafana/data';
import {
  config,
  CorrelationData,
  CorrelationsData,
  createMonitoringLogger,
  getBackendSrv,
  getDataSourceSrv,
} from '@grafana/runtime';
import { ExploreItemState } from 'app/types/explore';

import { formatValueName } from '../explore/PrometheusListView/ItemLabels';
import { parseLogsFrame } from '../logs/logsFrame';

import { EditFormDTO, FormDTO } from './Forms/types';
import { Correlation, CreateCorrelationParams, CreateCorrelationResponse } from './types';
import { CorrelationsResponse, getData, toEnrichedCorrelationsData } from './useCorrelations';

type DataFrameRefIdToDataSourceUid = Record<string, string>;

/**
 * Creates data links from provided CorrelationData object
 *
 * @param dataFrames list of data frames to be processed
 * @param correlations list of of possible correlations that can be applied
 * @param dataFrameRefIdToDataSourceUid a map that for provided refId references corresponding data source ui
 */
export const attachCorrelationsToDataFrames = (
  dataFrames: DataFrame[],
  correlations: CorrelationData[],
  dataFrameRefIdToDataSourceUid: DataFrameRefIdToDataSourceUid
): DataFrame[] => {
  dataFrames.forEach((dataFrame) => {
    const frameRefId = dataFrame.refId;
    if (!frameRefId) {
      return;
    }
    let dataSourceUid = dataFrameRefIdToDataSourceUid[frameRefId];

    // rawPrometheus queries append a value to refId to a separate dataframe for the table view
    if (dataSourceUid === undefined && dataFrame.meta?.preferredVisualisationType === 'rawPrometheus') {
      const formattedRefID = formatValueName(frameRefId);
      dataSourceUid = dataFrameRefIdToDataSourceUid[formattedRefID];
    }

    const sourceCorrelations = correlations.filter((correlation) => correlation.source.uid === dataSourceUid);
    decorateDataFrameWithInternalDataLinks(dataFrame, fixLokiDataplaneFields(sourceCorrelations, dataFrame));
  });

  return dataFrames;
};

const decorateDataFrameWithInternalDataLinks = (dataFrame: DataFrame, correlations: CorrelationData[]) => {
  dataFrame.fields.forEach((field) => {
    field.config.links = field.config.links?.filter((link) => link.origin !== DataLinkConfigOrigin.Correlations) || [];
    correlations.map((correlation) => {
      if (correlation.config.field === field.name) {
        if (correlation.type === 'query') {
          const targetQuery = correlation.config.target || {};
          field.config.links!.push({
            internal: {
              query: { ...targetQuery, datasource: { uid: correlation.target.uid } },
              datasourceUid: correlation.target.uid,
              datasourceName: correlation.target.name,
            },
            url: '',
            title: correlation.label || correlation.target.name,
            origin: DataLinkConfigOrigin.Correlations,
            meta: {
              transformations: correlation.config.transformations,
            },
          });
        } else if (correlation.type === 'external') {
          const externalTarget = correlation.config.target;
          field.config.links!.push({
            url: externalTarget.url,
            title: correlation.label || 'External URL',
            origin: DataLinkConfigOrigin.Correlations,
            meta: { transformations: correlation.config?.transformations },
          });
        }
      }
    });
  });
};

/*
If a correlation was made based on the log line field prior to the loki data plane, they would use the field "Line"

Change it to use whatever the body field name is post-loki data plane
*/
const fixLokiDataplaneFields = (correlations: CorrelationData[], dataFrame: DataFrame) => {
  return correlations.map((correlation) => {
    if (
      correlation.source.meta?.id === 'loki' &&
      config.featureToggles.lokiLogsDataplane === true &&
      correlation.config.field === 'Line'
    ) {
      const logsFrame = parseLogsFrame(dataFrame);
      if (logsFrame != null && logsFrame.bodyField.name !== undefined) {
        correlation.config.field = logsFrame?.bodyField.name;
      }
    }
    return correlation;
  });
};

export const getCorrelationsBySourceUIDs = async (sourceUIDs: string[]): Promise<CorrelationsData> => {
  return lastValueFrom(
    getBackendSrv().fetch<CorrelationsResponse>({
      url: `/api/datasources/correlations`,
      method: 'GET',
      showErrorAlert: false,
      params: {
        sourceUID: sourceUIDs,
      },
    })
  )
    .then(getData)
    .then(toEnrichedCorrelationsData);
};

export const createCorrelation = async (
  sourceUID: string,
  correlation: CreateCorrelationParams
): Promise<CreateCorrelationResponse> => {
  return getBackendSrv().post<CreateCorrelationResponse>(`/api/datasources/uid/${sourceUID}/correlations`, correlation);
};

const getDSInstanceForPane = async (pane: ExploreItemState) => {
  if (pane.datasourceInstance?.meta.mixed) {
    return await getDataSourceSrv().get(pane.queries[0].datasource);
  } else {
    return pane.datasourceInstance;
  }
};

export const generateDefaultLabel = async (sourcePane: ExploreItemState, targetPane: ExploreItemState) => {
  return Promise.all([getDSInstanceForPane(sourcePane), getDSInstanceForPane(targetPane)]).then((dsInstances) => {
    return dsInstances[0]?.name !== undefined && dsInstances[1]?.name !== undefined
      ? `${dsInstances[0]?.name} to ${dsInstances[1]?.name}`
      : '';
  });
};

export const generatePartialEditSpec = (data: EditFormDTO, correlation: Correlation): Partial<CorrelationSpec> => {
  let partialSpec: Partial<CorrelationSpec> = {};
  if (data.label !== correlation.label) {
    partialSpec.label = data.label;
  }
  if (data.description !== correlation.description) {
    partialSpec.description = data.description;
  }
  if (data.type !== correlation.type) {
    partialSpec.type = data.type;
  }

  // target is only loosely defined as an object, so always copy it
  partialSpec.config = { field: data.config.field, target: data.config.target };

  if (
    data.config.transformations !== undefined &&
    !isEqual(data.config.transformations, correlation.config.transformations)
  ) {
    partialSpec.config.transformations = data.config.transformations.map((t) => {
      return { expression: t.expression, field: t.field, mapValue: t.mapValue, type: t.type };
    });
  }
  return partialSpec;
};

export const generateAddSpec = async (data: FormDTO): Promise<CorrelationSpec> => {
  const dsSrv = getDataSourceSrv();
  const sourceDs = await dsSrv.get(data.sourceUID);
  let targetDs;
  if ('targetUID' in data) {
    targetDs = await dsSrv.get(data.targetUID!);
  }

  return {
    label: data.label,
    description: data.description,
    source: { group: sourceDs.type, name: sourceDs.uid },
    target: targetDs?.uid !== undefined ? { group: targetDs.type, name: targetDs?.uid } : undefined,
    type: data.type,
    config: {
      field: data.config.field,
      target: { ...data.config.target },
      transformations: data.config.transformations,
    },
  };
};

export const correlationsLogger = createMonitoringLogger('features.correlations');
