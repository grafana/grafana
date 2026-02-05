import { DataSourceInstanceSettings, DataSourceJsonData } from '@grafana/data';

interface JsonData extends DataSourceJsonData {
  oauthPassThru?: unknown; // we do not assume boolean, to be more robust
  azureCredentials?: {
    authType?: unknown;
  };
}

function isOauthEnabled(ds: DataSourceInstanceSettings<JsonData>): boolean {
  const oauth = ds.jsonData.oauthPassThru;
  // we are working with json-data here, the content may not necessarily be a boolean,
  // so we do this in a careful way.
  if (oauth === undefined) {
    return false;
  }

  if (oauth === false) {
    return false;
  }

  if (oauth === true) {
    return true;
  }

  // for us it is safer to assume true when there is some weird value used in the jsondata.
  return true;
}

function isProblematicAzureAuth(ds: DataSourceInstanceSettings<JsonData>): boolean {
  return ds.jsonData.azureCredentials?.authType === 'currentuser';
}

export function isQueryServiceCompatible(datasources: Array<DataSourceInstanceSettings<JsonData>>) {
  for (let ds of datasources) {
    if (isOauthEnabled(ds)) {
      return false;
    }

    if (isProblematicAzureAuth(ds)) {
      return false;
    }
  }
  return true;
}
