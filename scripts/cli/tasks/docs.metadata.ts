import { Task, TaskRunner } from './task';
import glob from 'glob';
import fs from 'fs';
import { performance, PerformanceObserver } from 'perf_hooks';
import path from 'path';
import omitBy from 'lodash/omitBy';
import { withCustomConfig, FileParser, ComponentDoc, PropItem } from 'react-docgen-typescript';
import metadataParser from 'markdown-yaml-metadata-parser';
import * as ts from 'typescript';

interface ComponentMetadata {
  category: string;
  description: string;
  props: any;
}
interface ComponentDocs {
  name: string;
  docs?: string; // MD
  path?: string; // Component path -> relative to WAT?!
  meta: ComponentMetadata;
}
interface DocsMetadata {
  readme: string;
  changelog: string;
  components: ComponentDocs[];
  guidelines?: string;
}

const obs = new PerformanceObserver(items => {
  console.log(items.getEntries()[0].name, items.getEntries()[0].duration);
  performance.clearMarks();
});
obs.observe({ entryTypes: ['measure'] });

const findComponentMarkdownPath = (mdFilePaths: string[], componentName: string) => {
  const result = mdFilePaths.filter(mdPath => {
    return path.parse(mdPath).name === componentName;
  });

  if (result.length > 1) {
    throw new Error(`Multiple markdown files for ${componentName} component`);
  }

  return result[0];
};

const parseTsConfig = tsconfigPath => {
  // ref: https://github.com/styleguidist/react-docgen-typescript/blob/master/src/parser.ts#L130
  const basePath = path.dirname(tsconfigPath);
  const { config, error } = ts.readConfigFile(tsconfigPath, filename => fs.readFileSync(filename, 'utf8'));

  if (error !== undefined) {
    const errorText = `Cannot load custom tsconfig.json from provided path: ${tsconfigPath}, with error code: ${
      error.code
    }, message: ${error.messageText}`;
    throw new Error(errorText);
  }

  const { options, errors } = ts.parseJsonConfigFileContent(config, ts.sys, basePath, {}, tsconfigPath);

  if (errors && errors.length) {
    throw errors[0];
  }

  return options;
};

const getTsProgramAndParser = (filePaths: string[]): [ts.Program, FileParser] => {
  // By default react-docgen-typescript creates new ts program on each file parsed.
  // This has a huge impact on performance resulting in perse time of 600-900ms per file.
  // To improve the performance, we are creating progrm once with all files to be processed.

  const tsConfig = parseTsConfig(`${process.cwd()}/packages/grafana-ui/tsconfig.json`);
  const tsProgram = ts.createProgram(filePaths, tsConfig);
  const tsParser = withCustomConfig(`${process.cwd()}/packages/grafana-ui/tsconfig.json`, {});
  return [tsProgram, tsParser];
};

const isExternalProp = (propDoc: PropItem) => {
  return !!(propDoc.parent && propDoc.parent.fileName.indexOf('node_modules') > -1);
};

const cleanupComponentPropTypes = (doc: ComponentDoc[]) => {
  return doc.map(d => {
    if (d.displayName === 'SelectOption') {
      debugger;
    }
    return {
      ...d,
      props: omitBy(d.props, isExternalProp),
    };
  });
};
const metadataGenerationTaskRunner: TaskRunner<void> = async () => {
  const docs: DocsMetadata = {} as DocsMetadata;

  const readme = fs.readFileSync('packages/grafana-ui/README.md', 'utf8');
  const changelog = fs.readFileSync('packages/grafana-ui/CHANGELOG.md', 'utf8');
  docs.readme = readme;
  docs.changelog = changelog;
  docs.components = [];

  // Load components markdown files
  const markdownFiles = glob.sync('packages/grafana-ui/src/components/**/*.md');

  // Find components path, ignore stories and tests
  const componentFiles = glob.sync(`packages/grafana-ui/src/components/**/*.tsx`).filter(file => {
    return file.indexOf('.story.tsx') === -1 && file.indexOf('.test.tsx') === -1;
  });

  const [tsProgram, tsParser] = getTsProgramAndParser(componentFiles);

  docs.components = componentFiles.map(component => {
    const componentDocs: ComponentDocs = {} as ComponentDocs;
    const componentName = path.parse(component).name;

    performance.mark('tsparse');
    const componentPropTypes = cleanupComponentPropTypes(tsParser.parseWithProgramProvider(component, () => tsProgram));

    performance.mark('tsparse-end');
    performance.measure('Parsing TS', 'tsparse', 'tsparse-end');

    const mdFile = findComponentMarkdownPath(markdownFiles, componentName);

    componentDocs.name = componentName;
    componentDocs.meta = {
      // TODO: Cleanup props that does not belong to @grafana/ui
      // i.e. properties from react types
      props: componentPropTypes,
    } as ComponentMetadata;

    if (!mdFile) {
      console.log(`${componentName} is missing docs!`);
    } else {
      console.log(`${componentName} reading docs...`);
      const componentMd = fs.readFileSync(mdFile, 'utf8');

      // @ts-ignore
      const meta = metadataParser(componentMd);
      componentDocs.meta = {
        ...componentDocs.meta,
        ...meta.metadata,
      };
      componentDocs.docs = meta.content;
    }

    return componentDocs;
  });

  debugger;

  fs.writeFile(`${process.cwd()}/packages/grafana-ui/docs/metadata.json`, JSON.stringify(docs, null, 2), err => {
    if (err) {
      console.error(err);
      return;
    }
    console.log('File has been created');
  });
};

export const metadataGenerationTask = new Task<void>();
metadataGenerationTask.setName('Docs metadata generation');
metadataGenerationTask.setRunner(metadataGenerationTaskRunner);
