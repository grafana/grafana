const { execSync } = require('child_process');
const path = require('path');

// Helper function to create paths relative to project root
const projectPath = (basePath) => (relativePath) => path.join(basePath, relativePath);

// Helper to remove quotes from operation IDs
const removeQuotes = (str) => {
  if (typeof str !== 'string') {
    return str;
  }
  return str.replace(/^['"](.*)['"]$/, '$1');
};

// Helper to format operation IDs for filter endpoints
const formatOperationIds = () => (operationArray) => {
  if (!Array.isArray(operationArray)) {
    return '';
  }
  return operationArray.map((op) => `'${removeQuotes(op)}'`).join(', ');
};

// List of created or modified files
const getFilesToFormat = (groupName) => [
  `public/app/api/clients/${groupName}/baseAPI.ts`,
  `public/app/api/clients/${groupName}/index.ts`,
  `scripts/generate-rtk-apis.ts`,
  `public/app/core/reducers/root.ts`,
  `public/app/store/configureStore.ts`,
];

// Action function for running yarn generate-apis
const runGenerateApis = (basePath) => (_, __) => {
  try {
    console.log('⏳ Running yarn generate-apis to generate endpoints...');
    execSync('yarn generate-apis', { stdio: 'inherit', cwd: basePath });
    return '✅ API endpoints generated successfully!';
  } catch (error) {
    console.error('❌ Failed to generate API endpoints:', error.message);
    return '❌ Failed to generate API endpoints. See error above.';
  }
};

// Action function for formatting files with prettier and eslint
const formatFiles = (basePath, createProjectPath) => (_, config) => {
  const filesToFormat = config.files.map((file) => createProjectPath(basePath)(file));

  try {
    const filesList = filesToFormat.map((file) => `"${file}"`).join(' ');

    console.log('🧹 Running ESLint on generated/modified files...');
    try {
      execSync(`yarn eslint --fix ${filesList}`, { cwd: basePath });
    } catch (error) {
      console.warn(`⚠️ Warning: ESLint encountered issues: ${error.message}`);
    }

    console.log('🧹 Running Prettier on generated/modified files...');
    try {
      execSync(`yarn prettier --write ${filesList}`, { cwd: basePath });
    } catch (error) {
      console.warn(`⚠️ Warning: Prettier encountered issues: ${error.message}`);
    }

    return '✅ Files linted and formatted successfully!';
  } catch (error) {
    console.error('⚠️ Warning: Formatting operations failed:', error.message);
    return '⚠️ Warning: Formatting operations failed.';
  }
};

// Validation helpers
const validateGroup = (group) => {
  return group && group.includes('.grafana.app') ? true : 'Group should be in format: name.grafana.app';
};

const validateVersion = (version) => {
  return version && /^v\d+[a-z]*\d+$/.test(version) ? true : 'Version should be in format: v0alpha1, v1beta2, etc.';
};

module.exports = {
  projectPath,
  formatOperationIds,
  validateGroup,
  validateVersion,
  getFilesToFormat,
  runGenerateApis,
  formatFiles,
};
