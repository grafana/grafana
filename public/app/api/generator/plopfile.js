module.exports = function (plop) {
  // Add input validation helpers
  plop.setHelper('validateGroup', (group) => {
    return group && group.includes('.grafana.app') 
      ? true 
      : 'Group should be in format: name.grafana.app';
  });
  
  plop.setHelper('validateVersion', (version) => {
    return version && /^v\d+[a-z]*\d+$/.test(version) 
      ? true 
      : 'Version should be in format: v0alpha1, v1beta2, etc.';
  });

  plop.setGenerator('rtk-api-client', {
    description: 'Generate RTK Query API client for a Grafana API group',
    prompts: [
      {
        type: 'input',
        name: 'group',
        message: 'API group (e.g. dashboard.grafana.app):',
        validate: (input) => plop.getHelper('validateGroup')(input)
      },
      {
        type: 'input',
        name: 'version',
        message: 'API version (e.g. v0alpha1):',
        validate: (input) => plop.getHelper('validateVersion')(input)
      },
      {
        type: 'input',
        name: 'reducerPath',
        message: 'Reducer path (e.g. dashboardAPI):',
        validate: (input) => input && input.endsWith('API') 
          ? true 
          : 'Reducer path should end with "API" (e.g. dashboardAPI)'
      },
      {
        type: 'input',
        name: 'operationIds',
        message: 'Operation IDs to include (comma-separated):',
        validate: (input) => input && input.trim() 
          ? true 
          : 'At least one operation ID is required'
      }
    ],
    actions: function(data) {
      // Format data for templates
      data.operationIdArray = data.operationIds.split(',').map(id => id.trim());
      data.typeExports = data.operationIdArray.map(op => {
        return op.charAt(0).toUpperCase() + op.slice(1);
      });
      
      return [
        // Create baseAPI.ts
        {
          type: 'add',
          path: 'public/app/api/clients/{{camelCase group}}/baseAPI.ts',
          templateFile: 'public/app/api/generator/templates/baseAPI.ts.hbs',
        },
        
        // Update generate-rtk-apis.ts
        {
          type: 'modify',
          path: 'scripts/generate-rtk-apis.ts',
          pattern: /outputFiles: {/,
          template: 'outputFiles: {\n    \'../public/app/api/clients/{{camelCase group}}/endpoints.gen.ts\': {\n      apiFile: \'../public/app/api/clients/{{camelCase group}}/baseAPI.ts\',\n      schemaFile: \'../data/openapi/{{group}}-{{version}}.json\',\n      filterEndpoints: [{{#each operationIdArray}}\'{{this}}\'{{#unless @last}}, {{/unless}}{{/each}}],\n      tag: true,\n    },',
        },
        
        // Create index.ts
        {
          type: 'add',
          path: 'public/app/api/clients/{{camelCase group}}/index.ts',
          templateFile: 'public/app/api/generator/templates/index.ts.hbs',
        },
        
        // Update reducers and middleware
        {
          type: 'append',
          path: 'public/app/core/reducers/root.ts',
          pattern: '// PLOP_INJECT_IMPORT',
          template: 'import { {{camelCase reducerPath}} } from \'../../api/clients/{{camelCase group}}\';',
        },
        {
          type: 'append',
          path: 'public/app/core/reducers/root.ts',
          pattern: '// PLOP_INJECT_REDUCER',
          template: '  [{{camelCase reducerPath}}.reducerPath]: {{camelCase reducerPath}}.reducer,',
        },
        {
          type: 'append',
          path: 'public/app/store/configureStore.ts',
          pattern: '// PLOP_INJECT_IMPORT',
          template: 'import { {{camelCase reducerPath}} } from \'../api/clients/{{camelCase group}}\';',
        },
        {
          type: 'append',
          path: 'public/app/store/configureStore.ts',
          pattern: '// PLOP_INJECT_MIDDLEWARE',
          template: '        {{camelCase reducerPath}}.middleware,',
        },
        
        // Automatically generate endpoints
        {
          type: 'runCommand',
          command: 'yarn generate-apis'
        }
      ];
    }
  });
}; 
