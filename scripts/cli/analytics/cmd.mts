import path from 'path';
import { Project } from 'ts-morph';
import { findAnalyticsEvents } from './index.mts';
// import { formatEventsAsMarkdown } from './formatters/markdown';

const CREATE_EVENT_FACTORY_PATH = path.resolve('public/app/core/services/echo/Echo.ts');
const SOURCE_FILE_PATTERNS = ['public/app/core/components/AppChrome/History/*.ts'];
// const OUTPUT_FORMAT = 'markdown';

const project = new Project({
  tsConfigFilePath: path.resolve('tsconfig.json'),
});
const files = project.getSourceFiles(SOURCE_FILE_PATTERNS);

const events = findAnalyticsEvents(files, CREATE_EVENT_FACTORY_PATH);

console.log(events);
