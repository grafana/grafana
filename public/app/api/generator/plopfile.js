const path = require('path');

module.exports = function (plop) {
  // Get the base path (project root)
  const basePath = path.resolve(__dirname, '../../../..');

  // Custom action function for displaying messages
  plop.setActionType('logMessage', function(answers, config) {
    console.log(config.message);
    return '✅ Message logged successfully';
  });

  // Helper function to create paths relative to project root
  const projectPath = (relativePath) => path.join(basePath, relativePath);

  // Helper to remove quotes from operation IDs
  plop.setHelper('removeQuotes', (str) => {
    if (typeof str !== 'string') {
      return str;
    }
    return str.replace(/^['"](.*)['"]$/, '$1');
  });

  // Helper to format operation IDs for filter endpoints
  plop.setHelper('formatOperationIds', (operationArray) => {
    if (!Array.isArray(operationArray)) {
      return '';
    }
    return operationArray.map((op) => `'${plop.getHelper('removeQuotes')(op)}'`).join(', ');
  });

  // Helper to format operation IDs for hooks
  plop.setHelper('formatHooks', (operationArray) => {
    if (!Array.isArray(operationArray)) {
      return '';
    }
    return operationArray
      .map((op) => {
        const cleanOp = plop.getHelper('removeQuotes')(op);
        return `use${cleanOp.charAt(0).toUpperCase() + cleanOp.slice(1)}`;
      })
      .join(', ');
  });

  // Helper to format type exports
  plop.setHelper('formatTypeExports', (operationArray) => {
    if (!Array.isArray(operationArray)) {
      return '';
    }
    return operationArray
      .map((op) => {
        const cleanOp = plop.getHelper('removeQuotes')(op);
        return `type ${cleanOp}`;
      })
      .join(', ');
  });

  // Helper function to generate actions for creating RTK API client
  const generateRtkApiActions = (data) => {
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
        pattern: /  },\n  },/g,  // Match the end of the last entry and the end of outputFiles
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
        template: `  [${reducerPath}.reducerPath]: ${reducerPath}.reducer,\n  // PLOP_INJECT_REDUCER`,
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
        template: `        ${reducerPath}.middleware,\n        // PLOP_INJECT_MIDDLEWARE`,
      },

      // Display success message using the custom action type
      {
        type: 'logMessage',
        message: '✅ Files created and configuration updated!\n\nNext step: Run the following command to generate endpoints:\n\n  yarn generate-apis\n'
      }
    ];
  };

  // Add input validation helpers
  plop.setHelper('validateGroup', (group) => {
    return group && group.includes('.grafana.app') ? true : 'Group should be in format: name.grafana.app';
  });

  plop.setHelper('validateVersion', (version) => {
    return version && /^v\d+[a-z]*\d+$/.test(version) ? true : 'Version should be in format: v0alpha1, v1beta2, etc.';
  });

  plop.setHelper('extractGroupName', (group) => {
    return group.split('.')[0];
  });

  plop.setGenerator('rtk-api-client', {
    description: 'Generate RTK Query API client for a Grafana API group',
    prompts: [
      {
        type: 'input',
        name: 'group',
        message: 'API group (e.g. dashboard.grafana.app):',
        validate: (input) => plop.getHelper('validateGroup')(input),
      },
      {
        type: 'input',
        name: 'version',
        message: 'API version (e.g. v0alpha1):',
        default: 'v0alpha1',
        validate: (input) => plop.getHelper('validateVersion')(input),
      },
      {
        type: 'input',
        name: 'reducerPath',
        message: 'Reducer path (e.g. dashboardAPI):',
        validate: (input) =>
          input && input.endsWith('API') ? true : 'Reducer path should end with "API" (e.g. dashboardAPI)',
      },
      {
        type: 'input',
        name: 'operationIds',
        message: 'Operation IDs to include (comma-separated):',
        validate: (input) => (input && input.trim() ? true : 'At least one operation ID is required'),
      },
    ],
    actions: function (data) {
      // Format data for templates
      data.operationIdArray = data.operationIds.split(',').map((id) => id.trim());
      data.groupName = data.group.split('.')[0];

      // Generate actions
      return generateRtkApiActions(data);
    },
  });
};
