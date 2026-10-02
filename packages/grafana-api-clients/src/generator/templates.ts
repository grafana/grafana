export interface TemplateInput {
  group: string;
  groupName: string;
  version: string;
  reducerPath: string;
  endpoints: string;
}

/** Strip surrounding quotes from a string, if present. */
function removeQuotes(str: string): string {
  return str.replace(/^['"](.*)['"]$/, '$1');
}

/** Format a comma-separated endpoint string into quoted, comma-separated identifiers. */
export function formatEndpoints(endpointsInput: string): string {
  return endpointsInput
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map((op) => `'${removeQuotes(op)}'`)
    .join(', ');
}

/** lowerCamel reducer path from a group name and version, e.g. `notificationsAlertingAPIv0alpha1`. */
export function deriveReducerPath(groupName: string, version: string): string {
  const camel = groupName.replace(/\.([a-z])/g, (_, letter: string) => letter.toUpperCase());
  return `${camel}API${version}`;
}

export function renderBaseAPI(input: Pick<TemplateInput, 'group' | 'version' | 'reducerPath'>, imports: string): string {
  return `import { createApi } from '@reduxjs/toolkit/query/react';

${imports}

export const API_GROUP = '${input.group}' as const;
export const API_VERSION = '${input.version}' as const;
export const BASE_URL = getAPIBaseURL(API_GROUP, API_VERSION);

export const api = createApi({
  reducerPath: '${input.reducerPath}',
  baseQuery: createBaseQuery({
    baseURL: BASE_URL,
  }),
  endpoints: () => ({}),
});
`;
}

export function renderIndexTs(): string {
  return `export { BASE_URL, API_GROUP, API_VERSION } from './baseAPI';
import { generatedAPI as rawAPI } from './endpoints.gen';

export * from './endpoints.gen';
export const generatedAPI = rawAPI.enhanceEndpoints({});
`;
}

export function renderConfigEntry(input: Pick<TemplateInput, 'groupName' | 'version' | 'endpoints'>): string {
  const endpointsSuffix = input.endpoints ? `, [${formatEndpoints(input.endpoints)}]` : '';
  return `  ...createAPIConfig('${input.groupName}', '${input.version}'${endpointsSuffix}),`;
}
export function getRTKClientEntries({
  groupName,
  reducerPath,
  version,
}: Pick<TemplateInput, 'groupName' | 'reducerPath' | 'version'>) {
  return {
    importEntry: `import { generatedAPI as ${reducerPath} } from './${groupName}/${version}';`,
    reducerEntry: `[${reducerPath}.reducerPath]: ${reducerPath}.reducer,`,
    middlewareEntry: `${reducerPath}.middleware,`,
  };
}
