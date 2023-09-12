import { getLinkToDocs } from './getLinkToDocs';

export const PrepareTimeSeriesHelper = () => {
  return `
  Prepare time series transformation is useful when a data source returns time series data in a format that isn't supported by the panel you want to use. For more information about data frame formats, refer to [Data frames](https://grafana.com/docs/grafana/latest/developers/plugins/introduction-to-plugin-development/data-frames/).

  This transformation helps you resolve this issue by converting the time series data from either the wide format to the long format or the other way around.

  Select the 'Multi-frame time series' option to transform the time series data frame from the wide to the long format.

  Select the 'Wide time series' option to transform the time series data frame from the long to the wide format.

  > **Note:** This transformation is available in Grafana 7.5.10+ and Grafana 8.0.6+.
  ${getLinkToDocs()}
  `;
};
