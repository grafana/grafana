import path from 'path';
import { Project } from 'ts-morph';
import { findAnalyticsEvents } from './findAllEvents.mts';
import { formatEventsAsMarkdown } from './outputFormats/markdown.mts';

const CREATE_EVENT_FACTORY_PATH = path.resolve('public/app/core/services/echo/Echo.ts');
const SOURCE_FILE_PATTERNS = ['**/*.ts'];
const OUTPUT_FORMAT = 'markdown';

const project = new Project({
  tsConfigFilePath: path.resolve('tsconfig.json'),
});
const files = project.getSourceFiles(SOURCE_FILE_PATTERNS);

const events = findAnalyticsEvents(files, CREATE_EVENT_FACTORY_PATH);

if (OUTPUT_FORMAT === 'markdown') {
  console.log(formatEventsAsMarkdown(events));
} else {
  console.log(JSON.stringify(events, null, 2));
}
