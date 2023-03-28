import { DataFrame, DataLinkConfigOrigin } from '@grafana/data';

import { CorrelationData } from './useCorrelations';

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
    const dataSourceUid = dataFrameRefIdToDataSourceUid[frameRefId];
    const sourceCorrelations = correlations.filter((correlation) => correlation.source.uid === dataSourceUid);
    decorateDataFrameWithInternalDataLinks(dataFrame, sourceCorrelations);
  });

  return dataFrames;
};

const decorateDataFrameWithInternalDataLinks = (dataFrame: DataFrame, correlations: CorrelationData[]) => {
  dataFrame.fields.forEach((field) => {
    correlations.map((correlation) => {
      if (correlation.config?.field === field.name) {
        field.config.links =
          field.config.links?.filter((link) => link.origin !== DataLinkConfigOrigin.Correlations) || [];
        field.config.links.push({
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
