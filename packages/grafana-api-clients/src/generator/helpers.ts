import { execSync } from 'child_process';
import fs from 'fs';
import { OpenAPIV3 } from 'openapi-types';
import path from 'path';

type PlopActionFunction = (
  answers: Record<string, unknown>,
  config?: Record<string, unknown>
) => string | Promise<string>;

// Helper to remove quotes from operation IDs
export const removeQuotes = (str: string | unknown) => {
  if (typeof str !== 'string') {
    return str;
  }
  return str.replace(/^['"](.*)['"]$/, '$1');
};

export const formatEndpoints = () => (endpointsInput: string | string[]) => {
  if (Array.isArray(endpointsInput)) {
    return endpointsInput.map((op) => `'${removeQuotes(op)}'`).join(', ');
  }

  // Handle string input (comma-separated)
  if (typeof endpointsInput === 'string') {
    const endpointsArray = endpointsInput
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    return endpointsArray.map((op) => `'${removeQuotes(op)}'`).join(', ');
  }

  return '';
};

// List of created or modified files
export const getFilesToFormat = (groupName: string, version: string, isEnterprise = false) => {
  const apiClientBasePath = isEnterprise
    ? 'public/app/extensions/api/clients'
    : 'packages/grafana-api-clients/src/clients/rtkq';
  const generateScriptPath = isEnterprise
    ? 'local/generate-enterprise-apis.ts'
    : 'packages/grafana-api-clients/src/scripts/generate-rtk-apis.ts';

  return [
    `${apiClientBasePath}/${groupName}/${version}/baseAPI.ts`,
    `${apiClientBasePath}/${groupName}/${version}/index.ts`,
    generateScriptPath,
    ...(isEnterprise
      ? []
      : [
          `packages/grafana-api-clients/src/index.ts`,
          `packages/grafana-api-clients/src/clients/rtkq/index.ts`,
          `packages/grafana-api-clients/package.json`,
        ]),
  ];
};

export const runGenerateApis =
  (basePath: string): PlopActionFunction =>
  (answers, config) => {
    try {
      const isEnterprise = answers.isEnterprise || (config && config.isEnterprise);

      let command;
      if (isEnterprise) {
        command =
          'yarn workspace @grafana/api-clients process-specs && npx rtk-query-codegen-openapi ./local/generate-enterprise-apis.ts';
      } else {
        command = 'yarn workspace @grafana/api-clients generate-apis';
      }

      console.log(`⏳ Running ${command} to generate endpoints...`);
      execSync(command, { stdio: 'inherit', cwd: basePath });
      return '✅ API endpoints generated successfully!';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Failed to generate API endpoints:', errorMessage);
      return '❌ Failed to generate API endpoints. See error above.';
    }
  };

export const formatFiles =
  (basePath: string): PlopActionFunction =>
  (_, config) => {
    if (!config || !Array.isArray(config.files)) {
      console.error('Invalid config passed to formatFiles action');
      return '❌ Formatting failed: Invalid configuration';
    }

    const filesToFormat = config.files.map((file: string) => path.join(basePath, file));

    try {
      const filesList = filesToFormat.map((file: string) => `"${file}"`).join(' ');

      console.log('🧹 Running ESLint on generated/modified files...');
      try {
        execSync(`yarn eslint --fix ${filesList}`, { cwd: basePath });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ Warning: ESLint encountered issues: ${errorMessage}`);
      }

      console.log('🧹 Running Prettier on generated/modified files...');
      try {
        // '--ignore-path' is necessary so the gitignored files ('local/' folder) can still be formatted
        execSync(`yarn prettier --write ${filesList} --ignore-path=./.prettierignore`, { cwd: basePath });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ Warning: Prettier encountered issues: ${errorMessage}`);
      }

      return '✅ Files linted and formatted successfully!';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('⚠️ Warning: Formatting operations failed:', errorMessage);
      return '⚠️ Warning: Formatting operations failed.';
    }
  };

export const validateGroup = (group: string) => {
  return group && group.includes('.grafana.app') ? true : 'Group should be in format: name.grafana.app';
};

export const validateVersion = (version: string) => {
  return version && /^v\d+[a-z]*\d+$/.test(version) ? true : 'Version should be in format: v0alpha1, v1beta2, etc.';
};

export const updatePackageJsonExports =
  (basePath: string): PlopActionFunction =>
  (answers) => {
    try {
      const { groupName, version } = answers;

      if (!groupName || !version) {
        return '❌ Missing groupName or version for package.json update';
      }

      const packageJsonPath = path.join(basePath, 'packages/grafana-api-clients/package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      // Create the new export entry
      const newExportKey = `./rtkq/${groupName}/${version}`;
      const newExportValue = {
        import: `./src/clients/rtkq/${groupName}/${version}/index.ts`,
        require: `./src/clients/rtkq/${groupName}/${version}/index.ts`,
      };

      // Check if export already exists
      if (packageJson.exports[newExportKey]) {
        return `✅ Export for ${newExportKey} already exists in package.json`;
      }

      // Add the new export entry
      packageJson.exports[newExportKey] = newExportValue;

      // Write the updated package.json back to file
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

      return `✅ Added export for ${newExportKey} to package.json`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Failed to update package.json exports:', errorMessage);
      return '❌ Failed to update package.json exports. See error above.';
    }
  };

/**
 * TODO: Make this work more generically with endpoints that don't have operationIds defined -
 * then we can allow selection of endpoints in the generator
 */
export const getOperationIds = (apiSpec: OpenAPIV3.Document) => {
  return (
    Object.values(apiSpec.paths).flatMap((path) => {
      return Object.entries(path || {})
        .filter(([name]) => name !== 'parameters')
        .flatMap(([_, pathItem]) => {
          if (typeof pathItem === 'object' && 'operationId' in pathItem && pathItem.operationId) {
            return pathItem.operationId;
          }
          return null;
        })
        .filter((id) => id !== null);
    }) || []
  );
};
