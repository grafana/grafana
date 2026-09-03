import path from 'path';
import {
  Node,
  SyntaxKind,
  type CallExpression,
  type SourceFile,
  type Type,
  type VariableStatement,
  type JSDoc,
} from 'ts-morph';

import { resolveOwner } from './codeowners.mts';
import { extractSilentFromOptions } from './findAllEvents.mts';
import { getMetadataFromJSDocs, getJsDocsFromNode, resolveType } from './typeResolution.mts';
import type { EventData, EventNamespace, EventPropertySchema, JSDocMetadata } from './types.mts';

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

  const [arg, eventOptionsArg, ...restArgs] = callExpr.getArguments();
  if (!arg || !Node.isStringLiteral(arg) || restArgs.length > 0) {
    throw new Error(`Expected ${fnName} to be called with a string literal name and an optional options object`);
  }

  // Per-event silent (`factory(name, { silent: true })`) overrides the
  // factory-level setting. Falls back to factoryOptions.silent if not present.
  const eventSilent = eventOptionsArg ? extractSilentFromOptions(eventOptionsArg) : undefined;
  const silent = eventSilent ?? eventNamespace.silent;

  const metadata = parseEventMetadata(callExpr);
  if (!metadata.description) {
    throw new Error(`Description not found for event '${arg.getLiteralText()}'`);
  }

  if (!metadata.owner) {
    // CODEOWNERS matching requires a path relative to the repo root
    const relativeFilePath = path.relative(process.cwd(), callExpr.getSourceFile().getFilePath());
    const owner = resolveOwner(relativeFilePath);
    metadata.owner = owner;
  }

  const eventName = arg.getLiteralText();
  // Names the event and its file so a parse failure points at the definition to fix.
  const location = `event '${eventName}' in ${path.relative(process.cwd(), callExpr.getSourceFile().getFilePath())}`;
  // Properties come from the TypeScript type, not the source text — e.g. the ClickProperties in createNavEvent<ClickProperties>('click').
  const { properties: ownProperties, variants } = resolveEventProperties(type, callExpr, location);

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
    description: metadata.description,
    owner: metadata.owner,
    properties: mergedProperties,
    variants,
    silent,
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
  const jsDocs = getEventJsDocs(eventCallExpr);
  if (jsDocs.length < 1) {
    throw new Error(`Expected JSDoc comment for event declaration at ${eventCallExpr.getSourceFile().getFilePath()}`);
  }

  return getMetadataFromJSDocs(jsDocs);
};

/**
 * Given the type of an event function (e.g. `(props: ClickProperties) => void`),
 * returns the schema of its properties, empty if the event takes no properties. Union properties
 * also return one schema per variant, so the report can show which combinations are valid.
 * Reads from the TypeScript type system rather than source text.
 */
const resolveEventProperties = (
  type: Type,
  callExpr: CallExpression,
  location: string
): { properties?: EventPropertySchema[]; variants?: EventPropertySchema[][] } => {
  // The factory call returns a function like (props: ClickProperties) => void — we want the parameter type.
  const [callSignature, ...restCallSignatures] = type.getCallSignatures();
  if (callSignature === undefined || restCallSignatures.length > 0) {
    throw new Error(`Expected ${location} to be a function with one call signature, got ${type.getText()}`);
  }

  const [parameter, ...restParameters] = callSignature.getParameters();
  if (parameter === undefined || restParameters.length > 0) {
    throw new Error(`Expected ${location} to have one parameter`);
  }

  const declarations = parameter.getDeclarations();
  if (declarations.length === 0) {
    throw new Error(`Expected the parameter of ${location} to have at least one declaration`);
  }

  const parameterType = parameter.getTypeAtLocation(declarations[0]);

  if (parameterType.isObject() || parameterType.isIntersection()) {
    return { properties: requireDescriptions(describeObjectParameters(parameterType, location), location) };
  } else if (parameterType.isVoid()) {
    return {};
  } else if (parameterType.isUnion()) {
    // Exact<P, A> distributes over a union P, and every distributed member resolves its properties
    // through A's constraint — which only exposes the keys common to all variants, as A["surface"].
    // The explicit type argument is the undistributed union, so variant-only properties survive.
    const [typeArgument] = callExpr.getTypeArguments();
    if (!typeArgument) {
      throw new Error(`Expected ${location} to declare its union properties as an explicit type argument`);
    }

    const variants = describeUnionVariants(typeArgument.getType(), location);

    return {
      properties: requireDescriptions(mergeUnionVariants(variants), location),
      variants,
    };
  }

  throw new Error(
    `Expected the parameter type of ${location} to be an object, a union of objects, or void, got ${parameterType.getText()}`
  );
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

const describeObjectParameters = (objectType: Type, location: string): EventPropertySchema[] => {
  return objectType.getProperties().map((property) => {
    // A property has several declarations whenever types are combined — EventVariants intersects a
    // documented base into each variant, so the type comes from any declaration (they agree after
    // narrowing) while only the base carries the JSDoc.
    const declarations = property.getDeclarations();
    if (declarations.length === 0) {
      throw new Error(`Expected property '${property.getName()}' of ${location} to have a declaration`);
    }

    for (const declaration of declarations) {
      if (!Node.isPropertySignature(declaration)) {
        throw new Error(
          `Expected property '${property.getName()}' of ${location} to be a property signature, got ${declaration.getKindName()}`
        );
      }
    }

    const resolvedType = resolveType(property.getTypeAtLocation(declarations[0]));
    const description = declarations
      .map((declaration) => getMetadataFromJSDocs(getJsDocsFromNode(declaration)).description)
      .find((candidate) => candidate !== undefined);

    return {
      name: property.getName(),
      type: resolvedType,
      description,
    };
  });
};

// The report publishes one row per property, so an undescribed property ships as a blank cell.
// Fail instead: ESLint only checks interfaces, and properties declared in type aliases slip past it.
const requireDescriptions = (properties: EventPropertySchema[], location: string): EventPropertySchema[] => {
  const undocumented = properties.filter((property) => !property.description).map((property) => property.name);
  if (undocumented.length > 0) {
    throw new Error(
      `Expected every property of ${location} to have a JSDoc description, missing: ${undocumented.join(', ')}`
    );
  }

  return properties;
};

// resolveType joins unions with ' | ', so splitting on the same separator keeps a merged type flat and duplicate-free.
const mergeTypeText = (a: string, b: string): string => {
  return [...new Set([...a.split(' | '), ...b.split(' | ')])].join(' | ');
};

const describeUnionVariants = (unionType: Type, location: string): EventPropertySchema[][] => {
  return unionType.getUnionTypes().map((variant) => {
    if (!variant.isObject() && !variant.isIntersection()) {
      throw new Error(`Expected every variant of ${location} to be an object, got ${variant.getText()}`);
    }

    return describeObjectParameters(variant, location);
  });
};

const mergeUnionVariants = (variants: EventPropertySchema[][]): EventPropertySchema[] => {
  const merged = new Map<string, EventPropertySchema>();

  for (const variant of variants) {
    for (const property of variant) {
      const existing = merged.get(property.name);
      if (!existing) {
        merged.set(property.name, property);
        continue;
      }

      merged.set(property.name, {
        name: property.name,
        type: mergeTypeText(existing.type, property.type),
        description: existing.description ?? property.description,
      });
    }
  }

  return [...merged.values()];
};
