import path from 'path';
import type { NodePlopAPI, PlopGeneratorConfig } from 'plop';

import {
  projectPath as createProjectPath,
  formatOperationIds,
  validateGroup,
  validateVersion,
  getFilesToFormat,
  runGenerateApis,
  formatFiles,
  // The file extension is necessary to make the imports work with the --experimental-strip-types flag
  // @ts-ignore
} from './helpers.ts';

interface PlopData {
  groupName: string;
  group: string;
  version: string;
  reducerPath: string;
  operationIds: string;
  operationIdArray: string[];
}

// Simple type guard to check if an object has required PlopData properties
function isPlopData(data: unknown): data is Partial<PlopData> {
  return typeof data === 'object' && data !== null;
}

export default function plopGenerator(plop: NodePlopAPI): void {
  // Grafana root path
  const basePath = path.resolve(import.meta.dirname, '../../../..');
  // Create project path helper with the base path
  const projectPath = createProjectPath(basePath);

  // Register custom action types
  plop.setActionType('runGenerateApis', runGenerateApis(basePath));
  plop.setActionType('formatFiles', formatFiles(basePath, projectPath));

  // Used in templates to format operation IDs
  plop.setHelper('formatOperationIds', formatOperationIds());

  const generateRtkApiActions = (data: PlopData) => {
    const { reducerPath, groupName } = data;

    return [
      // Create baseAPI.ts
      {
        type: 'add',
        path: projectPath(`public/app/api/clients/${groupName}/baseAPI.ts`),
        templateFile: './templates/baseAPI.ts.hbs',
      },

      {
        type: 'modify',
        path: projectPath('scripts/generate-rtk-apis.ts'),
        pattern: '// PLOP_INJECT_API_CLIENT',
        templateFile: './templates/config-entry.hbs',
      },

      // Create index.ts
      {
        type: 'add',
        path: projectPath(`public/app/api/clients/${groupName}/index.ts`),
        templateFile: './templates/index.ts.hbs',
      },

      // Update reducers and middleware
      {
        type: 'modify',
        path: projectPath('public/app/core/reducers/root.ts'),
        pattern: '// PLOP_INJECT_IMPORT',
        template: `import { ${reducerPath} } from '../../api/clients/${groupName}';\n// PLOP_INJECT_IMPORT`,
      },
      {
        type: 'modify',
        path: projectPath('public/app/core/reducers/root.ts'),
        pattern: '// PLOP_INJECT_REDUCER',
        template: `[${reducerPath}.reducerPath]: ${reducerPath}.reducer,\n  // PLOP_INJECT_REDUCER`,
      },
      {
        type: 'modify',
        path: projectPath('public/app/store/configureStore.ts'),
        pattern: '// PLOP_INJECT_IMPORT',
        template: `import { ${reducerPath} } from '../api/clients/${groupName}';\n// PLOP_INJECT_IMPORT`,
      },
      {
        type: 'modify',
        path: projectPath('public/app/store/configureStore.ts'),
        pattern: '// PLOP_INJECT_MIDDLEWARE',
        template: `${reducerPath}.middleware,\n        // PLOP_INJECT_MIDDLEWARE`,
      },

      // Format the generated files
      {
        type: 'formatFiles',
        files: getFilesToFormat(groupName),
      },

      // Run yarn generate-apis to generate endpoints
      {
        type: 'runGenerateApis',
      },
    ];
  };

  const generator: PlopGeneratorConfig = {
    description: 'Generate RTK Query API client for a Grafana API group',
    prompts: [
      {
        type: 'input',
        name: 'groupName',
        message: 'API group name (e.g. dashboard):',
        validate: (input: string) => (input && input.trim() ? true : 'Group name is required'),
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
          input && input.endsWith('API') ? true : 'Reducer path should end with "API" (e.g. dashboardAPI)',
      },
      {
        type: 'input',
        name: 'operationIds',
        message: 'Operation IDs to include (comma-separated, optional):',
        validate: () => true,
      },
    ],
    actions: function (data) {
      if (!isPlopData(data)) {
        throw new Error('Invalid data format received from prompts');
      }

      // Create a complete PlopData object with default values
      const typedData: PlopData = {
        groupName: data.groupName ?? '',
        group: data.group ?? '',
        version: data.version ?? '',
        reducerPath: data.reducerPath ?? '',
        operationIds: data.operationIds ?? '',
        operationIdArray: [],
      };

      // Format data for templates
      typedData.operationIdArray = typedData.operationIds
        ? typedData.operationIds
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
        : [];

      // Generate actions
      return generateRtkApiActions(typedData);
    },
  };

  plop.setGenerator('rtk-api-client', generator);
}
