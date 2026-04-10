import fs from 'fs/promises';
import path from 'path';
import { Project } from 'ts-morph';

import { findAllEvents } from './findAllEvents.ts';
import { formatEventsAsMarkdown } from './generateMarkdown.ts';

const DEFINE_FEATURE_EVENTS_PATH = '@grafana/runtime/internal';
const SOURCE_FILE_PATTERNS = ['**/*.ts'];
const OUTPUT_FORMAT = 'markdown';

const project = new Project({
  tsConfigFilePath: path.resolve('tsconfig.json'),
});
const files = project.getSourceFiles(SOURCE_FILE_PATTERNS);

const events = findAllEvents(files, DEFINE_FEATURE_EVENTS_PATH);

if (OUTPUT_FORMAT === 'markdown') {
  const markdown = await formatEventsAsMarkdown(events);
  console.log(markdown);

  const outputPath = path.resolve('docs/sources/analytics/analytics-report.md');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, markdown);
} else {
  console.log(JSON.stringify(events, null, 2));
}
