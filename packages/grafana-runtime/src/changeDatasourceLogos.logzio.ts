// LOGZ.IO GRAFANA CHANGE :: DEV-19985: add datasource logos
export const changeDatasourceLogos = (datasources: any): any => {
  if (!datasources) { return }
  const logos = {
    metrics: 'public/app/plugins/datasource/elasticsearch/img/logzio-metrics.svg',
    logs: 'public/app/plugins/datasource/elasticsearch/img/logzio-logs.svg',
    security: 'public/app/plugins/datasource/elasticsearch/img/logzio-security.svg',
    timeless: 'public/app/plugins/datasource/elasticsearch/img/logzio-timeless.svg',
    tracing: 'public/app/plugins/datasource/elasticsearch/img/logzio-tracing.svg',
    query: 'public/img/icn-datasource-logzio.svg',
  };
  const logzDsTypeByName: any = Object.values(datasources).reduce(
    (acc: any, datasource: any) => ({
      ...acc,
      [datasource.name]: datasource.jsonData?.logzDatasourceType,
    }),
    {}
  );

  Object.values(datasources).forEach((ds: any) => {
    const logzDSType: any = logzDsTypeByName[ds.name];
    let logo: string;

    switch (logzDSType) {
      case 'METRICS_ACCOUNT': {
        logo = logos.metrics;
        ds.sort = 'a' + ds.name;
        break;
      }
      case 'OWNER_ACCOUNT': {
        logo = logos.logs;
        ds.sort = 'b' + ds.name;
        break;
      }
      case 'SUB_ACCOUNT': {
        logo = logos.logs;
        ds.sort = 'c' + ds.name;
        break;
      }
      case 'SECURITY_ACCOUNT': {
        logo = logos.security;
        ds.sort = 'd' + ds.name;
        break;
      }
      case 'TIMELESS_INDEX': {
        logo = logos.timeless;
        ds.sort = 'e' + ds.name;
        break;
      }
      case 'TRACING_ACCOUNT': {
        logo = logos.tracing;
        ds.sort = 'f' + ds.name;
        break;
      }
      default: {
        logo = logos.query;
        break;
      }
    }

    ds.meta.info.logos.small = logo;
    ds.meta.info.logos.large = logo;
  });
};
// LOGZ.IO GRAFANA CHANGE :: end
