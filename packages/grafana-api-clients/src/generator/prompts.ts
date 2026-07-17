import Enquirer from 'enquirer';

import { getOpenAPISpecs } from './openapi.ts';
import { variantFor } from './variants.ts';

export interface GeneratorAnswers {
  isEnterprise: boolean;
  apiInfo: string;
  groupName: string;
  group: string;
  version: string;
  reducerPath: string;
  endpoints: string;
}

export function validateGroup(group: string): true | string {
  return group?.includes('.grafana.app') ? true : 'Group should be in format: name.grafana.app';
}

export function validateVersion(version: string): true | string {
  return version && /^v\d+([a-z]+\d+)?$/.test(version)
    ? true
    : 'Version should be in format: v1, v2, v0alpha1, v1beta2, etc.';
}

function formatConfirmValue(value: boolean | string): string {
  return value === true || value === 'true' ? 'yes' : 'no';
}

export async function confirmUpdateExistingClient(groupName: string, version: string): Promise<boolean> {
  const { shouldUpdate } = await Enquirer.prompt<{ shouldUpdate: boolean }>({
    type: 'confirm',
    name: 'shouldUpdate',
    message: `API client ${groupName}/${version} already exists. Regenerate endpoints from the existing config instead?`,
    initial: true,
    format: formatConfirmValue,
  });

  return shouldUpdate;
}

function validateReducerPath(input: string): true | string {
  return input?.endsWith('API') || input?.match(/API[a-z]\d+[a-z]*\d*$/)
    ? true
    : 'Reducer path should end with "API" or "API<version>" (e.g. dashboardAPI, dashboardAPIv0alpha1)';
}

function parseGroupName(apiInfo: string): string {
  return apiInfo.split('.grafana.app-')[0] ?? '';
}

function parseVersion(apiInfo: string): string {
  return apiInfo.split('.grafana.app-')[1]?.replace(/\.json$/, '') ?? '';
}

function deriveReducerPath(groupName: string, version: string): string {
  const camel = groupName.replace(/\.([a-z])/g, (_, letter: string) => letter.toUpperCase());
  return `${camel}API${version}`;
}

export async function runPrompts(basePath: string): Promise<GeneratorAnswers> {
  // 1. Enterprise?
  const { isEnterprise } = await Enquirer.prompt<{ isEnterprise: boolean }>({
    type: 'confirm',
    name: 'isEnterprise',
    message: 'Is this a Grafana Enterprise API?',
    initial: false,
    format: formatConfirmValue,
  });

  // 2. Pick OpenAPI spec
  const specs = getOpenAPISpecs(basePath, variantFor(isEnterprise));
  const autocompleteOptions = {
    type: 'autocomplete' as const,
    name: 'apiInfo',
    message: 'OpenAPI spec:',
    limit: 50,
    choices: specs,
    validate: (input: string) => (input?.trim() ? true : 'Selection is required'),
  };
  const { apiInfo } = await Enquirer.prompt<{ apiInfo: string }>(autocompleteOptions);

  // Compute defaults from the spec filename
  const defaultGroupName = parseGroupName(apiInfo);
  const defaultVersion = parseVersion(apiInfo);
  const defaultGroup = `${defaultGroupName}.grafana.app`;
  const defaultReducerPath = deriveReducerPath(defaultGroupName, defaultVersion);

  // 3-7. Remaining prompts
  const rest = await Enquirer.prompt<Omit<GeneratorAnswers, 'isEnterprise' | 'apiInfo'>>([
    {
      type: 'input',
      name: 'groupName',
      message: 'API group name:',
      initial: defaultGroupName,
      validate: (input: string) => (input?.trim() ? true : 'Group name is required'),
    },
    {
      type: 'input',
      name: 'group',
      message: 'API group:',
      initial: defaultGroup,
      validate: validateGroup,
    },
    {
      type: 'input',
      name: 'version',
      message: 'API version:',
      initial: defaultVersion,
      validate: validateVersion,
    },
    {
      type: 'input',
      name: 'reducerPath',
      message: 'Reducer path:',
      initial: defaultReducerPath,
      validate: validateReducerPath,
    },
    {
      type: 'input',
      name: 'endpoints',
      message: 'Endpoints to include (comma-separated, optional):',
    },
  ]);

  return { isEnterprise, apiInfo, ...rest };
}
