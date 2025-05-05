import { execSync } from 'child_process';
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
export const getFilesToFormat = (groupName: string, isEnterprise = false) => {
  const apiClientBasePath = isEnterprise ? 'public/app/extensions/api/clients' : 'public/app/api/clients';
  const generateScriptPath = isEnterprise ? 'local/generate-enterprise-apis.ts' : 'scripts/generate-rtk-apis.ts';

  return [
    `${apiClientBasePath}/${groupName}/baseAPI.ts`,
    `${apiClientBasePath}/${groupName}/index.ts`,
    generateScriptPath,
    ...(isEnterprise ? [] : [`public/app/core/reducers/root.ts`, `public/app/store/configureStore.ts`]),
  ];
};

export const runGenerateApis =
  (basePath: string): PlopActionFunction =>
  (answers, config) => {
    try {
      const isEnterprise = answers.isEnterprise || (config && config.isEnterprise);

      let command;
      if (isEnterprise) {
        command = 'yarn process-specs && npx rtk-query-codegen-openapi ./local/generate-enterprise-apis.ts';
      } else {
        command = 'yarn generate-apis';
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
