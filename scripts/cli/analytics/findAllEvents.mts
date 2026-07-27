import { Node, SyntaxKind, type SourceFile } from 'ts-morph';

import type { EventData, EventNamespace, EventPropertySchema } from './types.mts';

import { parseEventsFromFile } from './eventParser.mts';
import { getMetadataFromJSDocs, getJsDocsFromNode, resolveType } from './typeResolution.mts';

export const findAllEvents = (files: SourceFile[], defineFeatureEventsPath: string): EventData[] => {
  const eventMap = new Map<string, EventData>();

  for (const file of files) {
    const createEventFactoryImportedName = getDefineFeatureEventsLocalName(file, defineFeatureEventsPath);
    if (!createEventFactoryImportedName) {
      continue;
    }

    const eventNamespaces = findEventNamespaces(file, createEventFactoryImportedName);
    const events = parseEventsFromFile(file, eventNamespaces);

    for (const event of events) {
      if (eventMap.has(event.fullEventName)) {
        throw new Error(`Duplicate event name ${event.fullEventName} found in ${file.getFilePath()}`);
      }

      eventMap.set(event.fullEventName, event);
    }
  }

  return [...eventMap.values()];
};

/**
 * Returns the local name of `defineFeatureEvents` in this file, or null if not imported.
 *
 * This handles aliasing:
 *   import { defineFeatureEvents as def } from '@grafana/runtime/internal'
 * would return "def", not "defineFeatureEvents".
 */
const getDefineFeatureEventsLocalName = (sourceFile: SourceFile, defineFeatureEventsPath: string): string | null => {
  const importDecl = sourceFile.getImportDeclaration(
    (decl) => decl.getModuleSpecifierValue() === defineFeatureEventsPath
  );
  if (!importDecl) {
    return null;
  }

  const specifier = importDecl.getNamedImports().find((s) => s.getName() === 'defineFeatureEvents');

  if (!specifier) {
    return null; // imported from runtime/internal but not defineFeatureEvents
  }

  // getAliasNode() returns the "def" part of `defineFeatureEvents as def`.
  // If there's no alias, fall back to the original name.
  return specifier.getAliasNode()?.getText() ?? specifier.getName();
};

/**
 * Finds all calls to defineFeatureEvents in a file and returns a map of:
 *   factory variable name → { eventPrefixProject, eventPrefixFeature }
 *
 * Example: given
 *   const createNavEvent = defineFeatureEvents('grafana', 'navigation');
 *
 * Returns Map { "createNavEvent" → { factoryName: "createNavEvent", eventPrefixProject: "grafana", eventPrefixFeature: "navigation", defaultProperties: [...] } }
 */
const findEventNamespaces = (sourceFile: SourceFile, defineFeatureEventsName: string): Map<string, EventNamespace> => {
  const namespaces = new Map<string, EventNamespace>();

  for (const variableDecl of sourceFile.getVariableDeclarations()) {
    const initializer = variableDecl.getInitializer();
    if (!initializer || !Node.isCallExpression(initializer)) {
      continue;
    }

    // Is the right-hand side a call to our factory function?
    if (initializer.getExpression().getText() !== defineFeatureEventsName) {
      continue;
    }

    // Extract the two required string literal args: ('grafana', 'navigation')
    const [repoArg, featureArg, defaultPropsArg, factoryOptionsArg] = initializer.getArguments();
    if (!repoArg || !featureArg || !Node.isStringLiteral(repoArg) || !Node.isStringLiteral(featureArg)) {
      throw new Error(
        `defineFeatureEvents must be called with two string literal arguments at ${sourceFile.getFilePath()}`
      );
    }

    // Extract the optional third argument's type as default properties.
    // e.g. defineFeatureEvents('grafana', 'navigation', { schema_version: 1 })
    // would produce [{ name: 'schema_version', type: 'number' }]
    let defaultProperties: EventPropertySchema[] | undefined;
    if (defaultPropsArg) {
      const defaultPropsType = defaultPropsArg.getType();
      defaultProperties = defaultPropsType.getProperties().map((prop) => {
        const decl = prop.getDeclarations()[0];
        const propType = decl ? prop.getTypeAtLocation(decl) : prop.getDeclaredType();
        const description =
          decl && Node.isPropertySignature(decl)
            ? getMetadataFromJSDocs(decl.getJsDocs()).description
            : decl && Node.isPropertyAssignment(decl)
              ? getMetadataFromJSDocs(getJsDocsFromNode(decl)).description
              : undefined;
        return {
          name: prop.getName(),
          type: resolveType(propType),
          description,
        };
      });
    }

    // Extract the optional fourth argument: factoryOptions.silent.
    // e.g. defineFeatureEvents('grafana', 'cuj', undefined, { silent: true })
    // marks every event from this factory as silent unless overridden per-event.
    const silent = factoryOptionsArg ? extractSilentFromOptions(factoryOptionsArg) : undefined;

    const factoryName = variableDecl.getName();
    namespaces.set(factoryName, {
      factoryName,
      eventPrefixProject: repoArg.getLiteralText(), // "grafana"
      eventPrefixFeature: featureArg.getLiteralText(), // "navigation"
      defaultProperties,
      silent,
    });
  }

  return namespaces;
};

/**
 * Extracts `silent` from an object literal like `{ silent: true }`. Returns
 * undefined when the property is missing, not a boolean literal, or the
 * argument is not an object literal at all (e.g. `undefined`, a variable).
 */
export const extractSilentFromOptions = (optionsArg: Node): boolean | undefined => {
  if (!Node.isObjectLiteralExpression(optionsArg)) {
    return undefined;
  }

  const silentProperty = optionsArg.getProperty('silent');
  if (!silentProperty || !Node.isPropertyAssignment(silentProperty)) {
    return undefined;
  }

  const initializer = silentProperty.getInitializer();
  if (!initializer) {
    return undefined;
  }

  if (initializer.getKind() === SyntaxKind.TrueKeyword) {
    return true;
  }
  if (initializer.getKind() === SyntaxKind.FalseKeyword) {
    return false;
  }
  return undefined;
};
