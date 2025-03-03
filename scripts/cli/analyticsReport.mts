import { Project, Node, type SourceFile } from 'ts-morph';
import path from 'path';

/**
 * The goal of this script is to find all analytics events that are defined and output a report
 * of the events, their description, and the properties they accept.
 *
 * Events look like:
 *     const createUnifiedHistoryEvent = createEventFactory('grafana', 'unified_history');
 *
 *     interface UnifiedHistoryEntryClicked {
 *       /** We will also work with the current URL but we will get this from Rudderstack data * /
 *       entryURL: string;
 *
 *       /** In the case we want to go back to a specific query param, currently just a specific time range * /
 *       subEntry?: subEntryTypes;
 *     }
 *
 *     /** Triggered when a user clicks on an entry in the unified history list * /
 *     export const unifiedHistoryEntryClicked = createUnifiedHistoryEvent<UnifiedHistoryEntryClicked>('entry_clicked');
 *
 * This defines an event called grafana_unified_history_entry_clicked.
 */

// User-supplied path where `createEventFactory` is defined (relative to project root)
const createEventFactoryPath = path.resolve('public/app/core/services/echo/Echo.ts');
const tsConfigPath = path.resolve('tsconfig.json');

console.log('Creating project');
const project = new Project({
  tsConfigFilePath: tsConfigPath,
});

console.log('Getting source files');
// const files = project.getSourceFiles(['public/**/*.ts', 'public/**/*.tsx']);
const files = project.getSourceFiles(['public/app/core/components/AppChrome/History/*.ts']);

/**
 * Gets the name of the `createEventFactory` function imported from the correct file
 */
function getEventFactoryFunctionName(file: SourceFile): string | undefined {
  const imports = file.getImportDeclarations();

  /**
   * - Loop through all the imports
   * - Find the import for `createEventFactory`
   * - Check if it's imported from `Echo.ts` (and not just another file with the same export)
   * - Return the name of the function imported or aliased
   */
  for (const importDeclaration of imports) {
    const namedImports = importDeclaration.getNamedImports();

    for (const namedImport of namedImports) {
      const importName = namedImport.getName();

      if (importName === 'createEventFactory') {
        const moduleSpecifier = importDeclaration.getModuleSpecifierSourceFile();
        if (!moduleSpecifier) continue;

        if (moduleSpecifier.getFilePath() === createEventFactoryPath) {
          return namedImport.getAliasNode()?.getText() || importName;
        }
      }
    }
  }

  return undefined;
}

interface EventNamespace {
  factoryName: string;
  prefixRepo: string;
  prefixFeature: string;
}

for (const file of files) {
  console.log('---');
  const createEventFactoryImportedName = getEventFactoryFunctionName(file);
  if (!createEventFactoryImportedName) continue;

  console.log(`${file.getFilePath()}: ${createEventFactoryImportedName}`);

  const variableDecls = file.getVariableDeclarations();

  const eventNamespaces = new Map<string, EventNamespace>();

  // Find all createEventFactory() calls
  for (const variableDecl of variableDecls) {
    const eventFactoryName = variableDecl.getName();
    const initializer = variableDecl.getInitializer();
    if (!initializer) continue;
    if (!Node.isCallExpression(initializer)) continue;

    const initializerFnName = initializer.getExpression().getText();
    if (initializerFnName !== createEventFactoryImportedName) continue;

    const args = initializer.getArguments();
    if (args.length !== 2) {
      throw new Error(`Expected ${createEventFactoryImportedName} to have 2 arguments`);
    }

    const [argA, argB] = args;

    if (!Node.isStringLiteral(argA) || !Node.isStringLiteral(argB)) {
      throw new Error(`Expected ${createEventFactoryImportedName} to have 2 string arguments`);
    }

    const eventPrefixRepo = argA.getLiteralText();
    const eventPrefixFeature = argB.getLiteralText();

    console.log(
      `found where ${createEventFactoryImportedName} is called, ${eventFactoryName} = ${eventPrefixRepo}_${eventPrefixFeature}`
    );

    eventNamespaces.set(eventFactoryName, {
      factoryName: eventFactoryName,
      prefixRepo: eventPrefixRepo,
      prefixFeature: eventPrefixFeature,
    });
  }

  // console.log(eventNamespaces);

  // Find all the events defined in the file
  for (const variableDecl of variableDecls) {
    const initializer = variableDecl.getInitializer();
    if (!initializer) continue;
    if (!Node.isCallExpression(initializer)) continue;

    const initializerFnName = initializer.getExpression().getText();
    if (!eventNamespaces.has(initializerFnName)) continue;

    const eventNamespace = eventNamespaces.get(initializerFnName);
    if (!eventNamespace) throw new Error(`Event namespace not found for ${initializerFnName}`);

    const args = initializer.getArguments();
    if (args.length !== 1) {
      throw new Error(`Expected ${initializerFnName} to be called with only 1 argument`);
    }

    const arg = args[0];
    if (!Node.isStringLiteral(arg)) {
      throw new Error(`Expected ${initializerFnName} to be called with a string argument`);
    }

    const eventName = arg.getLiteralText();

    console.log(`EVENT: ${eventNamespace.prefixRepo}_${eventNamespace.prefixFeature}_${eventName}`);
  }
}
