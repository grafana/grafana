import path from 'path';

import {
  Node,
  SyntaxKind,
  type CallExpression,
  type SourceFile,
  type ts,
  type Type,
  type VariableStatement,
  type JSDoc,
} from 'ts-morph';

import type { EventData, EventNamespace, EventPropertySchema, JSDocMetadata } from './types.mts';

import { getMetadataFromJSDocs, getJsDocsFromNode, resolveType } from './typeResolution.mts';
import { resolveOwner } from './codeowners.mts';

/**
 * Finds all events declared in a file by locating calls to known factory functions
 * (e.g. createNavEvent) and walking up to the containing variable or property.
 *
 * Flat declarations:
 *   const trackClick = createNavEvent<ClickProperties>('click');
 *
 * Object groupings (including spreads):
 *   export const NavInteractions = {
 *     trackClick: createNavEvent<ClickProperties>('click'),
 *   };
 */
export const parseEventsFromFile = (file: SourceFile, eventNamespaces: Map<string, EventNamespace>): EventData[] => {
  // Loop through all function call expressions, check it's to a known event factory, and get the event info from it
  const allEvents = file
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .map((callExpr) => {
      const fnName = callExpr.getExpression().getText();
      if (!eventNamespaces.has(fnName)) {
        return null;
      }

      const event = parseEventFromCall(callExpr, eventNamespaces);
      return event;
    })
    .filter((event): event is EventData => event !== null);

  return allEvents;
};

/**
 * Parses a single event from a direct call expression, e.g.:
 *   const trackClick = createNavEvent<ClickProperties>('click');
 *
 * Returns null if the call is not to a known event factory.
 */
const parseEventFromCall = (
  callExpr: CallExpression,
  eventNamespaces: Map<string, EventNamespace>
): EventData | null => {
  const type = callExpr.getType();
  const fnName = callExpr.getExpression().getText();
  const eventNamespace = eventNamespaces.get(fnName);
  if (!eventNamespace) {
    return null;
  }

  const [arg, ...restArgs] = callExpr.getArguments();
  if (!arg || !Node.isStringLiteral(arg) || restArgs.length > 0) {
    throw new Error(`Expected ${fnName} to be called with only 1 string literal argument`);
  }

  const { description } = parseEventMetadata(callExpr);
  if (!description) {
    throw new Error(`Description not found for event '${arg.getLiteralText()}'`);
  }

  const eventName = arg.getLiteralText();
  // Properties come from the TypeScript type, not the source text — e.g. the ClickProperties in createNavEvent<ClickProperties>('click').
  const ownProperties = resolveEventProperties(type);

  // Namespace defaults (e.g. schema_version) are merged first; event-specific properties take precedence on name collision, matching { ...defaultProps, ...props }.
  const defaultProperties = eventNamespace.defaultProperties ?? [];
  const mergedProperties =
    defaultProperties.length > 0 || (ownProperties && ownProperties.length > 0)
      ? [
          ...defaultProperties,
          ...(ownProperties ?? []).filter((p) => !defaultProperties.some((d) => d.name === p.name)),
        ]
      : undefined;

  return {
    fullEventName: `${eventNamespace.eventPrefixProject}_${eventNamespace.eventPrefixFeature}_${eventName}`,
    repo: eventNamespace.eventPrefixProject,
    feature: eventNamespace.eventPrefixFeature,
    eventName,
    description,
    properties: mergedProperties,
  };
};

const getEventJsDocs = (eventCallExpr: CallExpression): JSDoc[] => {
  const parent = eventCallExpr.getParent();

  if (Node.isVariableDeclaration(parent)) {
    const variableStatement = getParentVariableStatement(parent);
    if (!variableStatement) {
      throw new Error(`Parent not found for ${parent.getText()}`);
    }

    return variableStatement.getJsDocs();
  }

  if (Node.isPropertyAssignment(parent)) {
    return getJsDocsFromNode(parent);
  }

  throw new Error(`Unexpected parent node kind ${parent?.getKindName() ?? 'unknown'} for event call expression`);
};

const parseEventMetadata = (eventCallExpr: CallExpression): JSDocMetadata => {
  // CODEOWNERS matching requires a path relative to the repo root
  const relativeFilePath = path.relative(process.cwd(), eventCallExpr.getSourceFile().getFilePath());
  const owner = resolveOwner(relativeFilePath);

  const jsDocs = getEventJsDocs(eventCallExpr);
  if (jsDocs.length < 1) {
    throw new Error(`Expected JSDoc comment for event declaration at ${eventCallExpr.getSourceFile().getFilePath()}`);
  }

  return {
    owner,
    ...getMetadataFromJSDocs(jsDocs),
  };
};

/**
 * Given the type of an event function (e.g. `(props: ClickProperties) => void`),
 * returns the schema of its properties, or undefined if the event takes no properties.
 * Reads from the TypeScript type system rather than source text.
 */
const resolveEventProperties = (type: Type): EventPropertySchema[] | undefined => {
  // The factory call returns a function like (props: ClickProperties) => void — we want the parameter type.
  const [callSignature, ...restCallSignatures] = type.getCallSignatures();
  if (callSignature === undefined || restCallSignatures.length > 0) {
    throw new Error(`Expected type to be a function with one call signature, got ${type.getText()}`);
  }

  const [parameter, ...restParameters] = callSignature.getParameters();
  if (parameter === undefined || restParameters.length > 0) {
    throw new Error('Expected function to have one parameter');
  }

  const declarations = parameter.getDeclarations();
  if (declarations.length === 0) {
    throw new Error('Expected parameter to have at least one declaration');
  }

  const parameterType = parameter.getTypeAtLocation(declarations[0]);

  if (parameterType.isObject() || parameterType.isIntersection()) {
    return describeObjectParameters(parameterType);
  } else if (parameterType.isVoid()) {
    return undefined;
  }

  throw new Error(`Expected parameter type to be an object or void, got ${parameterType.getText()}`);
};

// JSDoc attaches to the VariableStatement (the whole `const x = ...` line), not the VariableDeclaration inside it, so we walk up until we find one.
const getParentVariableStatement = (node: Node): VariableStatement | undefined => {
  let parent: Node | undefined = node.getParent();
  while (parent && !Node.isVariableStatement(parent)) {
    parent = parent.getParent();
  }

  if (parent && Node.isVariableStatement(parent)) {
    return parent;
  }

  return undefined;
};

const describeObjectParameters = (objectType: Type<ts.ObjectType | ts.IntersectionType>): EventPropertySchema[] => {
  return objectType.getProperties().map((property) => {
    const declarations = property.getDeclarations();
    if (declarations.length !== 1) {
      throw new Error(`Expected property to have one declaration, got ${declarations.length}`);
    }

    const declaration = declarations[0];
    const propertyType = property.getTypeAtLocation(declaration);
    const resolvedType = resolveType(propertyType);

    if (!Node.isPropertySignature(declaration)) {
      throw new Error(`Expected property to be a property signature, got ${declaration.getKindName()}`);
    }

    const { description } = getMetadataFromJSDocs(declaration.getJsDocs());
    return {
      name: property.getName(),
      type: resolvedType,
      description,
    };
  });
};
