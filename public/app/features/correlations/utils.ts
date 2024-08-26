import { lastValueFrom } from 'rxjs';

import { DataFrame, DataLinkConfigOrigin } from '@grafana/data';
import { createMonitoringLogger, getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
import { ExploreItemState } from 'app/types';

import { formatValueName } from '../explore/PrometheusListView/ItemLabels';

import { CORR_TYPES, CreateCorrelationParams, CreateCorrelationResponse } from './types';
import {
  CorrelationData,
  CorrelationsData,
  CorrelationsResponse,
  getData,
  toEnrichedCorrelationsData,
} from './useCorrelations';

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
    decorateDataFrameWithInternalDataLinks(dataFrame, sourceCorrelations);
  });

  return dataFrames;
};

const decorateDataFrameWithInternalDataLinks = (dataFrame: DataFrame, correlations: CorrelationData[]) => {
  dataFrame.fields.forEach((field) => {
    field.config.links = field.config.links?.filter((link) => link.origin !== DataLinkConfigOrigin.Correlations) || [];
    correlations.map((correlation) => {
      if (correlation.config?.field === field.name) {
        if (correlation.type === CORR_TYPES.query.value && correlation.target !== undefined) {
          const targetQuery = correlation.config?.target || {};
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
              transformations: correlation.config?.transformations,
            },
          });
        } else if (correlation.type === CORR_TYPES.external.value) {
          const externalTarget = correlation.config.target;
          if ('url' in externalTarget && externalTarget.url !== undefined) {
            field.config.links!.push({
              url: externalTarget.url,
              title: correlation.label || 'External URL',
              origin: DataLinkConfigOrigin.Correlations,
              meta: { transformations: correlation.config?.transformations },
            });
          }
        }
      }
    });
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

export const correlationsLogger = createMonitoringLogger('features.correlations');
