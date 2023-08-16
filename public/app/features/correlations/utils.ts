import { lastValueFrom } from 'rxjs';

import { DataFrame, DataLinkConfigOrigin } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';

import { formatValueName } from '../explore/PrometheusListView/ItemLabels';

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
        field.config.links!.push({
          internal: {
            query: correlation.config?.target,
            datasourceUid: correlation.target.uid,
            datasourceName: correlation.target.name,
            transformations: correlation.config?.transformations,
          },
          url: '',
          title: correlation.label || correlation.target.name,
          origin: DataLinkConfigOrigin.Correlations,
        });
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
