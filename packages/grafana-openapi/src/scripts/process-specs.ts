import fs from 'fs';
import path from 'path';

import { processOpenAPISpec } from './process-spec.ts';

/**
 * Process all files in a source directory and write results to output directory
 */
function processDirectory(sourceDir: string, outputDir: string) {
  // Skip if source directory doesn't exist
  if (!fs.existsSync(sourceDir)) {
    return;
  }

  // Create the output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const files = fs.readdirSync(sourceDir).filter((file: string) => file.endsWith('.json'));

  for (const file of files) {
    const inputPath = path.join(sourceDir, file);
    const outputPath = path.join(outputDir, file);

    console.log(`Processing file "${file}"...`);

    const fileContent = fs.readFileSync(inputPath, 'utf-8');

    let inputSpec;
    try {
      inputSpec = JSON.parse(fileContent);
    } catch (err) {
      console.error(`Invalid JSON file "${file}". Skipping this file.`);
      continue;
    }

    const outputSpec = processOpenAPISpec(inputSpec);
    fs.writeFileSync(outputPath, JSON.stringify(outputSpec, null, 2), 'utf-8');
    console.log(`Processing completed for file "${file}".`);
  }
}

// Grafana root path - navigate up from this script's directory
const basePath = path.resolve(import.meta.dirname, '../../../..');

const oss = {
  source: path.join(basePath, 'pkg/tests/apis/openapi_snapshots'),
  output: path.join(import.meta.dirname, '../apis'),
};

// This script is also used to process specs from the Enterprise repo but we're not publishing these as part of this package for now
const enterprise = {
  source: path.join(basePath, 'pkg/extensions/apiserver/tests/openapi_snapshots'),
  output: path.join(basePath, 'data/openapi'),
};

for (const config of [oss, enterprise]) {
  processDirectory(config.source, config.output);
}
