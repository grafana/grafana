const { parse } = require('ini');
const { existsSync, readFileSync } = require('node:fs');

/**
 * @param {string} grafanaRoot
 * @returns {Record<string, unknown>}
 */
function getEnvConfig(grafanaRoot) {
  const defaultSettings = readFileSync(`${grafanaRoot}/conf/defaults.ini`, { encoding: 'utf-8' });
  const customSettings = existsSync(`${grafanaRoot}/conf/custom.ini`)
    ? readFileSync(`${grafanaRoot}/conf/custom.ini`, { encoding: 'utf-8' })
    : '';

  const defaults = parse(defaultSettings);
  const custom = parse(customSettings);
  const merged = { ...defaults.frontend_dev, ...custom.frontend_dev };

  // Prefix frontend keys so callers can expose them through process.env.
  const env = {};
  for (const [key, value] of Object.entries(merged)) {
    env[`frontend_dev_${key}`] = value;
  }
  return env;
}

module.exports = { getEnvConfig };
