import fs from 'fs/promises';
import path from 'path';
import { Project } from 'ts-morph';

import { findAllEvents } from './findAllEvents.ts';
import { formatEventsAsMarkdown } from './generateMarkdown.ts';

const DEFINE_FEATURE_EVENTS_PATH = path.resolve('public/app/core/services/echo/Echo.ts');
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

  await fs.writeFile('analytics-report.md', markdown);
} else {
  console.log(JSON.stringify(events, null, 2));
}
