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
    operationArray = operationArray.split(',');
  }
  return operationArray.map((op) => `'${removeQuotes(op)}'`).join(', ');
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
};
