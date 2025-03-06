import type { Event, EventNamespace } from './types.mts';
import { parseEvents } from './eventParser.mts';
import { type SourceFile, Node } from 'ts-morph';

/**
 * Finds all events - calls to the function returned by createEventFactory - declared in a file
 *
 * An event feature namespace is defined by:
 *   const createNavEvent = createEventFactory('grafana', 'navigation');
 *
 * Which will be used to define multiple events like:
 *   interface ClickProperties {
 *     linkText: string;
 *   }
 *   const trackClick = createNavEvent<ClickProperties>('click');
 *   const trackExpand = createNavEvent('expand');
 */
export function findAnalyticsEvents(files: SourceFile[], createEventFactoryPath: string): Event[] {
  const allEvents: Event[] = files.flatMap((file) => {
    // Get the local imported name of createEventFactory
    const createEventFactoryImportedName = getEventFactoryFunctionName(file, createEventFactoryPath);
    if (!createEventFactoryImportedName) return [];

    // Find all calls to createEventFactory and the namespaces they create
    const eventNamespaces = findEventNamespaces(file, createEventFactoryImportedName);

    // Find all events defined in the file
    const events = parseEvents(file, eventNamespaces);
    return events;
  });

  return allEvents;
}

/**
 * Finds the local name of the createEventFactory function imported from the given path
 *
 * @param file - The file to search for the import
 * @param createEventFactoryPath - The path to the createEventFactory function
 */
function getEventFactoryFunctionName(file: SourceFile, createEventFactoryPath: string): string | undefined {
  const imports = file.getImportDeclarations();

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

function findEventNamespaces(file: SourceFile, createEventFactoryImportedName: string): Map<string, EventNamespace> {
  const variableDecls = file.getVariableDeclarations();
  const eventNamespaces = new Map<string, EventNamespace>();

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
      eventPrefixProject: eventPrefixRepo,
      eventPrefixFeature: eventPrefixFeature,
    });
  }

  return eventNamespaces;
}
