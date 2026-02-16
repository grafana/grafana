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

type DSSettings = DataSourceInstanceSettings<JsonData>;

function isProblematicAzureAuth(ds: DSSettings): boolean {
  return ds.jsonData.azureCredentials?.authType === 'currentuser';
}

type AllowedTypes = {
  types: string[];
};

// TODO: consider using a data-validation library
function parseAllowedTypes(data: unknown): AllowedTypes {
  // we want to be safe, this should never crash
  if (data != null && typeof data === 'object' && 'types' in data && Array.isArray(data.types)) {
    // typescript infers the array as any[], not unknown[], we need to correct this to have
    // typescript protect us.
    const types: unknown[] = data.types;

    if (types.every((x) => typeof x === 'string')) {
      return { types };
    } else {
      console.error('qscheck.parseFlags: non-string item in allowed');
      return { types: [] };
    }
  } else {
    console.error('qscheck.parseFlags: invalid data');
    return { types: [] };
  }
}

export function isQueryServiceCompatible(datasources: DSSettings[], allowedTypes: unknown) {
  const at = parseAllowedTypes(allowedTypes);
  if (!areDataSourceTypesAllowed(datasources, new Set(at.types))) {
    return false;
  }

  for (const ds of datasources) {
    if (isOauthEnabled(ds)) {
      return false;
    }

    if (isProblematicAzureAuth(ds)) {
      return false;
    }
  }
  return true;
}

function areDataSourceTypesAllowed(datasources: DSSettings[], allowedTypes: Set<string>): boolean {
  for (const ds of datasources) {
    if (!allowedTypes.has(ds.type)) {
      return false;
    }
  }
  return true;
}
