import { Task, TaskRunner } from './task';
import glob from 'glob';
import fs from 'fs';
import path from 'path';
import flatten from 'lodash/flatten';
import omitBy from 'lodash/omitBy';
import { withCustomConfig, FileParser, ComponentDoc, PropItem } from 'react-docgen-typescript';
import metadataParser from 'markdown-yaml-metadata-parser';
import * as ts from 'typescript';
import chokidar from 'chokidar';
import { Project, SourceFile } from 'ts-morph';

interface ComponentMetadata {
  category: string;
  description: string;
  props: any;
}
interface ComponentDocs {
  name: string;
  docs?: string;
  path?: string;
  meta: ComponentMetadata;
}
interface DocsMetadata {
  readme: string;
  changelog: string;
  components: ComponentDocs[];
  guidelines?: string;
  types: TypesMetadata;
}

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
    return {
      ...d,
      props: omitBy(d.props, isExternalProp),
    };
  });
};

interface TypeDefinition {
  name: string;
  definition: string;
  sourceFileName: string;
  sourceFilePath: string;
  jsdoc: string;
}
interface TypesMetadata {
  [key: string]: TypeDefinition[];
}

const getTypesFromSourceFile = (sourceFile: SourceFile): TypeDefinition[] => {
  const types = sourceFile.getTypeAliases();
  return types.map(t => {
    return {
      name: t.getName(),
      definition: t
        .getText()
        .split('=')[1]
        .trim(),
      sourceFileName: sourceFile.getBaseName(),
      sourceFilePath: sourceFile.getDirectoryPath(),
      jsdoc: t
        .getJsDocs()
        .map(d => d.getInnerText())
        .join('\n'),
    };
  });
};

const getTypesMetadata = (project: Project) => {
  const typeFiles = glob.sync('packages/grafana-ui/src/types/**/*.ts');

  const typeMetadata: TypeDefinition[] = flatten(
    typeFiles
      .map(filePath => {
        const ast = project.getSourceFile(filePath);
        return getTypesFromSourceFile(ast);
      })
      .filter(t => t.length > 0)
  );

  return typeMetadata.reduce(
    (acc, current) => {
      if (acc[current.sourceFileName]) {
        acc[current.sourceFileName].push(current);
      } else {
        acc[current.sourceFileName] = [current];
      }

      return acc;
    },
    {} as TypesMetadata
  );
};

const generateMetadata = (resolve?: () => void) => {
  const docs: DocsMetadata = {} as DocsMetadata;
  const readme = fs.readFileSync('packages/grafana-ui/README.md', 'utf8');
  const changelog = fs.readFileSync('packages/grafana-ui/CHANGELOG.md', 'utf8');
  const markdownFiles = glob.sync('packages/grafana-ui/src/components/**/*.md');

  const typeFilesProject = new Project({
    tsConfigFilePath: `${process.cwd()}/packages/grafana-ui/tsconfig.json`,
    addFilesFromTsConfig: false,
  });
  typeFilesProject.addExistingSourceFiles(`${process.cwd()}/packages/grafana-ui/src/types/*.ts`);

  docs.readme = readme;
  docs.changelog = changelog;
  docs.components = [];
  docs.types = getTypesMetadata(typeFilesProject);
  debugger;

  // Find components path, ignore stories and tests
  const componentFiles = glob.sync(`packages/grafana-ui/src/components/**/*.tsx`).filter(file => {
    return file.indexOf('.story.tsx') === -1 && file.indexOf('.test.tsx') === -1;
  });

  const [tsProgram, tsParser] = getTsProgramAndParser(componentFiles);

  docs.components = componentFiles.map(component => {
    const componentDocs: ComponentDocs = {} as ComponentDocs;
    const componentName = path.parse(component).name;

    const componentPropTypes = cleanupComponentPropTypes(tsParser.parseWithProgramProvider(component, () => tsProgram));

    const mdFile = findComponentMarkdownPath(markdownFiles, componentName);

    componentDocs.name = componentName;
    componentDocs.meta = {
      props: componentPropTypes,
    } as ComponentMetadata;

    if (!mdFile) {
      // console.log(`${componentName} is missing docs!`);
    } else {
      // console.log(`${componentName} reading docs...`);
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

  fs.writeFile(`${process.cwd()}/packages/grafana-ui/docs/metadata.json`, JSON.stringify(docs, null, 2), err => {
    if (err) {
      console.error(err);
      return;
    }
    if (resolve) {
      resolve();
    }
  });
};

const metadataGenerationTaskRunner: TaskRunner<void> = async () => {
  return new Promise((resolve, reject) => {
    try {
      generateMetadata(resolve);
    } catch (e) {
      reject(e);
      process.exit(1);
    }
  }).then(() => {
    const watcher = chokidar.watch('packages/grafana-ui/**/*.md', {
      ignored: ['packages/grafana-ui/node_modules'],
    });

    watcher.on('change', path => {
      console.log(path, 'has changed, regenerating metadata');
      generateMetadata();
    });
  });
};

export const metadataGenerationTask = new Task<void>();
metadataGenerationTask.setName('Docs metadata generation');
metadataGenerationTask.setRunner(metadataGenerationTaskRunner);
