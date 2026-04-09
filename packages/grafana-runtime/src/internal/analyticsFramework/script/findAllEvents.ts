import { Project, Node, type SourceFile } from 'ts-morph';

import type { EventData, EventNamespace } from '../types';

import { parseEvents } from './eventParser';

export const findAllEvents = (tsConfigPath: string): EventData[] => {
  const project = new Project({ tsConfigFilePath: tsConfigPath });
  const allEvents: EventData[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    // Step 1: does this file even use the framework?
    const localName = getDefineFeatureEventsLocalName(sourceFile);
    if (!localName) {
      continue;
    }

    // Step 2: find all factory variables in this file
    //   const createNavEvent = defineFeatureEvents('grafana', 'navigation');
    const eventNamespaces = findEventNamespaces(sourceFile, localName);
    if (eventNamespaces.size === 0) {
      continue;
    }

    // Step 3: parse all events defined with those factories and collect them
    const events = parseEvents(sourceFile, eventNamespaces);
    allEvents.push(...events);
  }

  return allEvents;
};

/**
 * Returns the local name of `defineFeatureEvents` in this file, or null if not imported.
 *
 * This handles aliasing:
 *   import { defineFeatureEvents as def } from '@grafana/runtime/internal'
 * would return "def", not "defineFeatureEvents".
 */
const getDefineFeatureEventsLocalName = (sourceFile: SourceFile): string | null => {
  const importDecl = sourceFile.getImportDeclaration(
    (decl) => decl.getModuleSpecifierValue() === '@grafana/runtime/internal'
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
const findEventNamespaces = (
  sourceFile: SourceFile,
  defineFeatureEventsName: string
): Map<string, Pick<EventNamespace, 'eventPrefixProject' | 'eventPrefixFeature'>> => {
  const namespaces = new Map();

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

    namespaces.set(variableDecl.getName(), {
      eventPrefixProject: repoArg.getLiteralText(), // "grafana"
      eventPrefixFeature: featureArg.getLiteralText(), // "navigation"
    });
  }

  return namespaces;
};
