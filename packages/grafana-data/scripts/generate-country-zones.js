#!/usr/bin/env node
/**
 * Script to regenerate country-and-zones.json from moment-timezone data
 *
 * This script extracts the country-to-timezone mapping from moment-timezone
 * and saves it as a JSON file for use without moment-timezone dependency.
 *
 * Usage:
 *   node scripts/generate-country-zones.js
 *
 * This script requires moment-timezone to be installed as a dev dependency.
 */

const fs = require('fs');
const path = require('path');

// Check if moment-timezone is available
let moment;
try {
  moment = require('moment-timezone');
} catch (e) {
  console.error('Error: moment-timezone is required to run this script.');
  console.error('Please install it temporarily: npm install --save-dev moment-timezone');
  process.exit(1);
}

// Get all countries and their zones from moment-timezone
const countries = moment.tz.countries();
const countryAndZones = [];

for (const countryCode of countries) {
  const zones = moment.tz.zonesForCountry(countryCode);
  countryAndZones.push({
    name: countryCode,
    zones: zones,
  });
}

// Sort by country code for consistency
countryAndZones.sort((a, b) => a.name.localeCompare(b.name));

// Write to JSON file
const outputPath = path.join(__dirname, '../src/datetime/country-and-zones.json');
const jsonContent = JSON.stringify(countryAndZones, null, 2);

fs.writeFileSync(outputPath, jsonContent + '\n');

console.log(`Generated country-and-zones.json with ${countryAndZones.length} countries`);
console.log(`Output: ${outputPath}`);
