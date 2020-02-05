import * as prettier from 'prettier';
import { useSpinner } from '../utils/useSpinner';
import { testPlugin } from './plugin/tests';
import { Task, TaskRunner } from './task';
import rimrafCallback from 'rimraf';
import { resolve as resolvePath } from 'path';
import { promisify } from 'util';
import globby from 'globby';
import execa from 'execa';
import { constants as fsConstants, promises as fs } from 'fs';
import { bundlePlugin as bundleFn, PluginBundleOptions } from './plugin/bundle';
import { Configuration, Linter, LintResult, RuleFailure } from 'tslint';

const { access, copyFile, readFile, writeFile } = fs;
const { COPYFILE_EXCL, F_OK } = fsConstants;
const rimraf = promisify(rimrafCallback);

interface PluginBuildOptions {
  coverage: boolean;
}

interface Fixable {
  fix?: boolean;
}

export const bundlePlugin = useSpinner<PluginBundleOptions>('Compiling...', async options => await bundleFn(options));

export const clean = useSpinner<void>('Cleaning', async () => await rimraf(`${process.cwd()}/dist`));

const copyIfNonExistent = (srcPath: string, destPath: string) =>
  copyFile(srcPath, destPath, COPYFILE_EXCL)
    .then(() => console.log(`Created: ${destPath}`))
    .catch(error => {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    });

export const prepare = useSpinner<void>('Preparing', async () => {
  await Promise.all([
    // Copy only if local tsconfig does not exist.  Otherwise this will work, but have odd behavior
    copyIfNonExistent(
      resolvePath(__dirname, '../../config/tsconfig.plugin.local.json'),
      resolvePath(process.cwd(), 'tsconfig.json')
    ),
    // Copy only if local prettierrc does not exist.  Otherwise this will work, but have odd behavior
    copyIfNonExistent(
      resolvePath(__dirname, '../../config/prettier.plugin.rc.js'),
      resolvePath(process.cwd(), '.prettierrc.js')
    ),
  ]);

  // Nothing is returned
});

// @ts-ignore
const typecheckPlugin = useSpinner<void>('Typechecking', async () => {
  await execa('tsc', ['--noEmit']);
});

const getTypescriptSources = () => globby(resolvePath(process.cwd(), 'src/**/*.+(ts|tsx)'));

const getStylesSources = () => globby(resolvePath(process.cwd(), 'src/**/*.+(scss|css)'));

export const prettierCheckPlugin = useSpinner<Fixable>('Prettier check', async ({ fix }) => {
  // @todo remove explicit params when possible -- https://github.com/microsoft/TypeScript/issues/35626
  const [prettierConfig, paths] = await Promise.all<object, string[]>([
    readFile(resolvePath(__dirname, '../../config/prettier.plugin.config.json'), 'utf8').then(
      contents => JSON.parse(contents) as object
    ),

    Promise.all([getStylesSources(), getTypescriptSources()]).then(results => results.flat()),
  ]);

  const promises: Array<Promise<{ path: string; success: boolean }>> = paths.map(path =>
    readFile(path, 'utf8')
      .then(contents => {
        const config = {
          ...prettierConfig,
          filepath: path,
        };

        if (fix && !prettier.check(contents, config)) {
          return prettier.format(contents, config);
        } else {
          return undefined;
        }
      })
      .then(newContents => {
        if (newContents === undefined) {
          return true; // Nothing to fix
        } else if (fix) {
          if (newContents.length > 10) {
            return writeFile(path, newContents)
              .then(() => {
                console.log(`Fixed: ${path}`);
                return true;
              })
              .catch(error => {
                console.log(`Error fixing ${path}`, error);
                return false;
              });
          }
          console.log(`No automatic fix for: ${path}`);
        }
        return false;
      })
      .then(success => ({ path, success }))
  );

  const failures = (await Promise.all(promises)).filter(({ success }) => !success);

  if (failures.length > 0) {
    console.log('\nFix Prettier issues in following files:');
    failures.forEach(({ path }) => console.log(path));
    console.log('\nRun toolkit:dev to fix errors');
    throw new Error('Prettier failed');
  }
});

export const lintPlugin = useSpinner<Fixable>('Linting', async ({ fix }) => {
  let tsLintConfigPath = resolvePath(process.cwd(), 'tslint.json');

  try {
    await access(tsLintConfigPath, F_OK);
  } catch (error) {
    tsLintConfigPath = resolvePath(__dirname, '../../config/tslint.plugin.json');
  }

  const options = {
    fix: fix === true,
    formatter: 'json',
  };

  const configuration = Configuration.findConfiguration(tsLintConfigPath).results;
  const sourcesToLint = await getTypescriptSources();

  const lintPromises = sourcesToLint.map(fileName =>
    readFile(fileName, 'utf8').then(contents => {
      const linter = new Linter(options);
      linter.lint(fileName, contents, configuration);
      return linter.getResult();
    })
  );

  const lintResults: LintResult[] = (await Promise.all(lintPromises)).filter(
    ({ errorCount, warningCount }) => errorCount > 0 || warningCount > 0
  );

  if (lintResults.length > 0) {
    console.log('\n');
    const failures = lintResults.reduce<RuleFailure[]>((failures, result) => {
      return [...failures, ...result.failures];
    }, []);
    failures.forEach(f => {
      // tslint:disable-next-line
      console.log(
        `${f.getRuleSeverity() === 'warning' ? 'WARNING' : 'ERROR'}: ${
          f.getFileName().split('src')[1]
        }[${f.getStartPosition().getLineAndCharacter().line + 1}:${
          f.getStartPosition().getLineAndCharacter().character
        }]: ${f.getFailure()}`
      );
    });
    console.log('\n');
    throw new Error(`${failures.length} linting errors found in ${lintResults.length} files`);
  }
});

export const pluginBuildRunner: TaskRunner<PluginBuildOptions> = async ({ coverage }) => {
  await clean();
  await prepare();
  await prettierCheckPlugin({ fix: false });
  await lintPlugin({ fix: false });
  await testPlugin({ updateSnapshot: false, coverage, watch: false });
  await bundlePlugin({ watch: false, production: true });
};

export const pluginBuildTask = new Task<PluginBuildOptions>('Build plugin', pluginBuildRunner);
