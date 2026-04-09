import { Node, type SourceFile } from 'ts-morph';

import type { EventData, EventNamespace } from '../types';

import { parseEvents } from './eventParser.ts';

export const findAllEvents = (files: SourceFile[], defineFeatureEventsPath: string): EventData[] => {
  const allEvents: EventData[] = files.flatMap((file) => {
    // Get the local imported name of defineFeatureEvents
    const createEventFactoryImportedName = getDefineFeatureEventsLocalName(file, defineFeatureEventsPath);
    if (!createEventFactoryImportedName) {
      return [];
    }
    // Find all calls to defineFeatureEvents and the namespaces they create
    const eventNamespaces = findEventNamespaces(file, createEventFactoryImportedName);

    // Find all events defined in the file
    const events = parseEvents(file, eventNamespaces);
    return events;
  });

  return allEvents;
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
 * Returns Map { "createNavEvent" → { eventPrefixProject: "grafana", eventPrefixFeature: "navigation" } }
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

    // Extract the two string literal args: ('grafana', 'navigation')
    const [repoArg, featureArg] = initializer.getArguments();
    if (!repoArg || !featureArg || !Node.isStringLiteral(repoArg) || !Node.isStringLiteral(featureArg)) {
      throw new Error(
        `defineFeatureEvents must be called with two string literal arguments at ${sourceFile.getFilePath()}`
      );
    }

    const factoryName = variableDecl.getName();
    namespaces.set(factoryName, {
      factoryName,
      eventPrefixProject: repoArg.getLiteralText(), // "grafana"
      eventPrefixFeature: featureArg.getLiteralText(), // "navigation"
    });
  }

  return namespaces;
};
