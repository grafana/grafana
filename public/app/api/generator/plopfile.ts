import path from 'path';
import type { NodePlopAPI, PlopGeneratorConfig } from 'plop';

import {
  formatEndpoints,
  validateGroup,
  validateVersion,
  getFilesToFormat,
  runGenerateApis,
  formatFiles,
  // The file extension is necessary to make the imports
  // work with the '--experimental-strip-types' flag
  // @ts-ignore
} from './helpers.ts';
// @ts-ignore
import { type ActionConfig, type PlopData, isPlopData } from './types.ts';

export default function plopGenerator(plop: NodePlopAPI) {
  // Grafana root path
  const basePath = path.resolve(import.meta.dirname, '../../../..');

  // Register custom action types
  plop.setActionType('runGenerateApis', runGenerateApis(basePath));
  plop.setActionType('formatFiles', formatFiles(basePath));

  // Used in templates to format endpoints
  plop.setHelper('formatEndpoints', formatEndpoints());

  const generateRtkApiActions = (data: PlopData) => {
    const { reducerPath, groupName, isEnterprise } = data;

    const apiClientBasePath = isEnterprise ? 'public/app/extensions/api/clients' : 'public/app/api/clients';
    const generateScriptPath = isEnterprise ? 'local/generate-enterprise-apis.ts' : 'scripts/generate-rtk-apis.ts';

    // Using app path, so the imports work on any file level
    const clientImportPath = isEnterprise ? '../extensions/api/clients' : 'app/api/clients';

    const apiPathPrefix = isEnterprise ? '../public/app/extensions/api/clients' : '../public/app/api/clients';

    const templateData = {
      ...data,
      apiPathPrefix,
    };

    // Base actions that are always added
    const actions: ActionConfig[] = [
      {
        type: 'add',
        path: path.join(basePath, `${apiClientBasePath}/${groupName}/baseAPI.ts`),
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
        path: path.join(basePath, `${apiClientBasePath}/${groupName}/index.ts`),
        templateFile: './templates/index.ts.hbs',
      },
    ];

    // Only add redux reducer and middleware for OSS clients
    if (!isEnterprise) {
      actions.push(
        {
          type: 'modify',
          path: path.join(basePath, 'public/app/core/reducers/root.ts'),
          pattern: '// PLOP_INJECT_IMPORT',
          template: `import { ${reducerPath} } from '${clientImportPath}/${groupName}';\n// PLOP_INJECT_IMPORT`,
        },
        {
          type: 'modify',
          path: path.join(basePath, 'public/app/core/reducers/root.ts'),
          pattern: '// PLOP_INJECT_REDUCER',
          template: `[${reducerPath}.reducerPath]: ${reducerPath}.reducer,\n  // PLOP_INJECT_REDUCER`,
        },
        {
          type: 'modify',
          path: path.join(basePath, 'public/app/store/configureStore.ts'),
          pattern: '// PLOP_INJECT_IMPORT',
          template: `import { ${reducerPath} } from '${clientImportPath}/${groupName}';\n// PLOP_INJECT_IMPORT`,
        },
        {
          type: 'modify',
          path: path.join(basePath, 'public/app/store/configureStore.ts'),
          pattern: '// PLOP_INJECT_MIDDLEWARE',
          template: `${reducerPath}.middleware,\n        // PLOP_INJECT_MIDDLEWARE`,
        }
      );
    }

    // Add formatting and generation actions
    actions.push(
      {
        type: 'formatFiles',
        files: getFilesToFormat(groupName, isEnterprise),
      },
      {
        type: 'runGenerateApis',
        isEnterprise,
      }
    );

    return actions;
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
        type: 'input',
        name: 'groupName',
        message: 'API group name (e.g. dashboard):',
        validate: (input: string) => (input?.trim() ? true : 'Group name is required'),
      },
      {
        type: 'input',
        name: 'group',
        message: 'API group (e.g. dashboard.grafana.app):',
        default: (answers: { groupName?: string }) => `${answers.groupName}.grafana.app`,
        validate: validateGroup,
      },
      {
        type: 'input',
        name: 'version',
        message: 'API version (e.g. v0alpha1):',
        default: 'v0alpha1',
        validate: validateVersion,
      },
      {
        type: 'input',
        name: 'reducerPath',
        message: 'Reducer path (e.g. dashboardAPI):',
        default: (answers: { groupName?: string }) => `${answers.groupName}API`,
        validate: (input: string) =>
          input?.endsWith('API') ? true : 'Reducer path should end with "API" (e.g. dashboardAPI)',
      },
      {
        type: 'input',
        name: 'endpoints',
        message: 'Endpoints to include (comma-separated, optional):',
        validate: () => true,
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
