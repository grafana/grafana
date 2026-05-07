import fs from 'fs';
import path from 'path';
import type { NodePlopAPI, PlopGeneratorConfig } from 'plop';

import {
  formatEndpoints,
  formatFiles,
  getFilesToFormat,
  runGenerateApis,
  updatePackageJsonExports,
  validateGroup,
  validateVersion,
} from './helpers.ts';
import { type ActionConfig, type PlopData, isPlopData } from './types.ts';

export default function plopGenerator(plop: NodePlopAPI) {
  // Grafana root path
  const basePath = path.resolve(import.meta.dirname, '../../../..');

  // Register custom action types
  plop.setActionType('runGenerateApis', runGenerateApis(basePath));
  plop.setActionType('formatFiles', formatFiles(basePath));
  plop.setActionType('updatePackageJsonExports', updatePackageJsonExports(basePath));

  // Used in templates to format endpoints
  plop.setHelper('formatEndpoints', formatEndpoints());

  const generateRtkApiActions = (data: PlopData) => {
    const { reducerPath, groupName, version, isEnterprise } = data;

    const apiClientBasePath = isEnterprise
      ? 'public/app/extensions/api/clients'
      : 'packages/grafana-api-clients/src/clients/rtkq';
    const generateScriptPath = isEnterprise
      ? 'local/generate-enterprise-apis.ts'
      : 'packages/grafana-api-clients/src/scripts/generate-rtk-apis.ts';

    const clientImportPath = isEnterprise ? '../extensions/api/clients' : '.';

    const apiPathPrefix = isEnterprise ? '../public/app/extensions/api/clients' : '../clients';

    const templateData = {
      ...data,
      apiPathPrefix,
    };

    // Base actions that are always added
    const actions: ActionConfig[] = [
      {
        type: 'add',
        path: path.join(basePath, `${apiClientBasePath}/${groupName}/${version}/baseAPI.ts`),
        templateFile: './templates/baseAPI.ts.hbs',
      },
      {
        type: 'modify',
        path: path.join(basePath, generateScriptPath),
        pattern: '// PLOP_INJECT_API_CLIENT - Used by the API client generator',
        templateFile: './templates/config-entry.hbs',
        data: templateData,
      },
      {
        type: 'add',
        path: path.join(basePath, `${apiClientBasePath}/${groupName}/${version}/index.ts`),
        templateFile: './templates/index.ts.hbs',
      },
    ];

    // Only add redux reducer and middleware for OSS clients
    if (!isEnterprise) {
      actions.push(
        {
          type: 'modify',
          path: '../clients/rtkq/index.ts',
          pattern: '// PLOP_INJECT_IMPORT',
          template: `import { generatedAPI as ${reducerPath} } from '${clientImportPath}/${groupName}/${version}';\n// PLOP_INJECT_IMPORT`,
        },
        {
          type: 'modify',
          path: '../clients/rtkq/index.ts',
          pattern: '// PLOP_INJECT_REDUCER',
          template: `[${reducerPath}.reducerPath]: ${reducerPath}.reducer,\n  // PLOP_INJECT_REDUCER`,
        },
        {
          type: 'modify',
          path: '../clients/rtkq/index.ts',
          pattern: '// PLOP_INJECT_MIDDLEWARE',
          template: `${reducerPath}.middleware,\n        // PLOP_INJECT_MIDDLEWARE`,
        },
        {
          type: 'updatePackageJsonExports',
        }
      );
    }

    // Add formatting and generation actions
    actions.push(
      {
        type: 'formatFiles',
        files: getFilesToFormat(groupName, version, isEnterprise),
      },
      {
        type: 'runGenerateApis',
        isEnterprise,
      }
    );

    return actions;
  };

  const getOpenAPISpecs = (isEnterprise: boolean): string[] => {
    const openapiDir = isEnterprise
      ? path.join(basePath, 'pkg/extensions/apiserver/tests/openapi_snapshots')
      : path.join(basePath, 'pkg/tests/apis/openapi_snapshots');

    try {
      const files = fs.readdirSync(openapiDir).filter((file: string) => file.endsWith('.json'));
      return files;
    } catch (e) {
      throw new Error(
        "No OpenAPI specs found! Are you trying to generate an API client for enterprise but haven't linked your local environment?"
      );
    }
  };

  const generator: PlopGeneratorConfig = {
    description: 'Generate RTK Query API client for a Grafana API group',
    prompts: [
      {
        type: 'confirm',
        name: 'isEnterprise',
        message: 'Is this a Grafana Enterprise API?',
        default: false,
      },
      {
        type: 'list',
        loop: false,
        choices: (answers: { isEnterprise?: boolean }) => {
          return getOpenAPISpecs(answers.isEnterprise ?? false);
        },
        pageSize: 50,
        name: 'apiInfo',
        message: 'OpenAPI spec:',
        validate: (input: string) => (input?.trim() ? true : 'Group name is required'),
      },
      {
        type: 'input',
        name: 'groupName',
        message: 'API group name:',
        validate: (input: string) => (input?.trim() ? true : 'Group name is required'),
        default: (answers: { apiInfo?: string }) => answers.apiInfo?.split('.grafana.app-')[0],
      },
      {
        type: 'input',
        name: 'group',
        message: 'API group:',
        default: (answers: { groupName?: string }) => `${answers.groupName}.grafana.app`,
        validate: validateGroup,
      },
      {
        type: 'input',
        name: 'version',
        message: 'API version:',
        default: (answers: { apiInfo?: string }) => answers.apiInfo?.split('.grafana.app-')[1].replace(/\.json$/, ''),
        validate: validateVersion,
      },
      {
        type: 'input',
        name: 'reducerPath',
        message: 'Reducer path:',
        default: (answers: { groupName?: string; version?: string }) => {
          const groupNameParsed = answers.groupName?.replace(/\.([a-z])/g, (_, letter) => letter.toUpperCase());
          return `${groupNameParsed}API${answers.version}`;
        },
        validate: (input: string) =>
          input?.endsWith('API') || input?.match(/API[a-z]\d+[a-z]*\d*$/)
            ? true
            : 'Reducer path should end with "API" or "API<version>" (e.g. dashboardAPI, dashboardAPIv0alpha1)',
      },
      {
        type: 'input',
        name: 'endpoints',
        default: undefined,
        message: 'Endpoints to include (comma-separated, optional):',
      },
    ],
    actions: function (data) {
      if (!isPlopData(data)) {
        throw new Error('Invalid data format received from prompts');
      }

      return generateRtkApiActions(data);
    },
  };

  plop.setGenerator('rtk-api-client', generator);
}
