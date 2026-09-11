/**
 * @file This file exports the function `printAffectedPluginsSection`
 * used to generate the affected plugins section in the report
 * that is used in `levitate-parse-json-report.js`
 */

const { execSync } = require('child_process');
const fs = require('fs');

/**
 * Extracts the package name from a given location string.
 *
 * @param {string} location - The location string containing the package information.
 * @returns {string} - The extracted package name, or an empty string if no match is found.
 */
function getPackage(location) {
  const match = location.match(/(.+\/)dist\//);
  if (match) {
    const packageJsonPath = match[1] + 'package.json';
    const data = fs.readFileSync(packageJsonPath, 'utf8');

    if (!data) {
      return '';
    }

    return JSON.parse(data)?.name || '';
  }
  return '';
}

const PANEL_URL = 'https://ops.grafana-ops.net/d/dmb2o0xnz/imported-property-details?orgId=1';

/**
 * Creates an array of HTML links for the given section and affecting properties.
 *
 * @param {Array} section - An array of objects, each containing `name` and `location` properties.
 * @param {Set} affectingProperties - A set of property names that are affected.
 * @returns {Array<string>} - An array of HTML link strings.
 */
function createLinks(section, affectingProperties) {
  return section
    .map(({ name, location }) => {
      const package = getPackage(location);

      if (!package && !affectingProperties.has(name)) {
        return undefined;
      }

      const link = PANEL_URL + `&var-propertyName=${name}&var-packageName=${package}`;

      return `<a href="${link}">${package}/${name}</a>`;
    })
    .filter((item) => item !== undefined);
}

/**
 * Generates an SQL query to select property names, package names, and plugin IDs
 * from the `plugin_imports` table based on the provided section data.
 *
 * @param {Array} section - An array of objects, each containing `name` and `location` properties.
 * @returns {string} - The generated SQL query string.
 */
function makeQuery(section) {
  const whereClause = section
    .map(({ name, location }) => {
      const package = getPackage(location);

      if (!package) {
        return undefined;
      }

      return `(property_name = '${name}' AND package_name = '${package}')`;
    })
    .filter((item) => item !== undefined)
    .join(' OR ');

  if (!whereClause) {
    return '';
  }

  return `
    SELECT DISTINCT
      property_name,
      package_name,
      plugin_id
    FROM
      \\\`grafanalabs-global.plugins_data.plugin_imports\\\`
    WHERE ${whereClause}
`;
}

/**
 * Extracts a specific column from a table represented as an array of lines.
 *
 * @param {Array<string>} lines - An array of strings, each representing a row in the table.
 * @param {number} columnIndex - The index of the column to extract.
 * @returns {Set<string>} - A set containing the unique values from the specified column.
 */
function getColumn(lines, columnIndex) {
  const set = new Set();
  const tableBody = lines.slice(3);

  for (let row of tableBody) {
    const columns = row.split('|').map((col) => col.trim());

    if (columns.length === 5) {
      const content = columns[columnIndex];

      set.add(content);
    }
  }

  return set;
}

/**
 * Generates a markdown section detailing the affected plugins based on the provided data.
 *
 * @param {Object} data - The data object containing `removals` and `changes` arrays.
 * @param {Array} data.removals - An array of objects representing removed items.
 * @param {Array} data.changes - An array of objects representing changed items.
 * @returns {string} - The generated markdown string detailing the affected plugins.
 */
function printAffectedPluginsSection(data) {
  const { removals, changes } = data;

  let markdown = '';

  try {
    const sqlQuery = makeQuery([...removals, ...changes]);
    if (!sqlQuery) {
      throw new Error("Couldn't generate SQL query");
    }

    const cmd = `bq query --nouse_legacy_sql "${sqlQuery}"`;
    const stdout = execSync(cmd, { encoding: 'utf-8' });

    const rows = stdout.trim().split('\n');

    if (rows.length > 3) {
      const pluginsColumnIndex = 3;
      const affectedPlugins = getColumn(rows, pluginsColumnIndex);

      markdown += `<h3>Number of affected plugins: ${affectedPlugins.size}</h3>`;
      markdown += '<p>To check the plugins affected by each import, click on the links below.</p>';

      const propertiesColumnIndex = 1;
      const affectingProperties = getColumn(rows, propertiesColumnIndex);

      if (removals.length > 0) {
        markdown += `<h4>Removals</h4>`;
        markdown += createLinks(removals, affectingProperties).join('<br>\n');
      }

      if (changes.length > 0) {
        markdown += `<h4>Changes</h4>`;
        markdown += createLinks(changes, affectingProperties).join('<br>\n');
      }
    }
  } catch (error) {
    markdown += `<h4>Error generating detailed report ${error}</h4>`;
    if (error.stdout) {
      markdown += `<h5>Error stdout ${error.stdout}</h5>`;
    }
    if (error.stderr) {
      markdown += `<h5>Error stderr ${error.stderr}</h5>`;
    }
  }

  return markdown;
}

module.exports = printAffectedPluginsSection;
