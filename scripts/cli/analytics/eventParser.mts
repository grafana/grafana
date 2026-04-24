import path from 'path';

import {
  Node,
  SyntaxKind,
  type CallExpression,
  type ObjectLiteralExpression,
  type PropertyAssignment,
  type SourceFile,
  type ts,
  type Type,
  type VariableStatement,
} from 'ts-morph';

import type { EventData, EventNamespace, EventPropertySchema } from './types.mts';

import { getMetadataFromJSDocs, resolveType } from './typeResolution.mts';
import { resolveOwner } from './codeowners.mts';

//TODO
//1. get function calls : within the obj they are also function calls
//2. just description => owner using code owner of the file
//3. find default property description

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
export const parseEvents = (file: SourceFile, eventNamespaces: Map<string, EventNamespace>): EventData[] => {
  const events: EventData[] = [];
  // Tracks which object literals have already been processed; one object can contain many factory calls, each of which would be a separate hit in the loop below.
  const processedObjectLiterals = new Set<ObjectLiteralExpression>();
  // CODEOWNERS matching requires a path relative to the repo root, not an absolute one.
  const relativeFilePath = path.relative(process.cwd(), file.getFilePath());

  // Start from the factory calls themselves and walk up, rather than iterating all variable declarations and checking their initializers.
  for (const callExpr of file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const fnName = callExpr.getExpression().getText();
    if (!eventNamespaces.has(fnName)) {
      continue;
    }

    // The parent tells us which pattern we're dealing with.
    const parent = callExpr.getParent();

    if (Node.isVariableDeclaration(parent)) {
      // Flat pattern: const trackClick = createNavEvent('click')
      const event = parseEventFromCall(callExpr.getType(), callExpr, eventNamespaces, () => {
        const stmt = getParentVariableStatement(parent);
        if (!stmt) {
          throw new Error(`Parent not found for ${parent.getText()}`);
        }
        // JSDoc attaches to the VariableStatement, not the VariableDeclaration inside it.
        return getMetadataFromJSDocs(stmt.getJsDocs());
      });
      if (event) {
        events.push(event);
      }
    } else if (Node.isPropertyAssignment(parent)) {
      // Object grouping pattern: const Interactions = { trackClick: createNavEvent('click') }
      const objectLiteral = parent.getParent();
      if (!Node.isObjectLiteralExpression(objectLiteral) || processedObjectLiterals.has(objectLiteral)) {
        continue;
      }
      processedObjectLiterals.add(objectLiteral);
      events.push(...parseEventsFromObjectLiteral(objectLiteral, eventNamespaces));
    }
  }

  // Resolve owner from CODEOWNERS based on the file that declares the events
  for (const event of events) {
    if (!event.owner) {
      event.owner = resolveOwner(relativeFilePath);
    }
  }

  return events;
};

/**
 * Parses a single event from a direct call expression, e.g.:
 *   const trackClick = createNavEvent<ClickProperties>('click');
 *
 * Returns null if the call is not to a known event factory.
 */
const parseEventFromCall = (
  type: Type,
  callExpr: CallExpression,
  eventNamespaces: Map<string, EventNamespace>,
  getMetadata: () => ReturnType<typeof getMetadataFromJSDocs>
): EventData | null => {
  const fnName = callExpr.getExpression().getText();
  const eventNamespace = eventNamespaces.get(fnName);
  if (!eventNamespace) {
    return null;
  }

  const [arg, ...restArgs] = callExpr.getArguments();
  if (!arg || !Node.isStringLiteral(arg) || restArgs.length > 0) {
    throw new Error(`Expected ${fnName} to be called with only 1 string literal argument`);
  }

  const { description } = getMetadata();
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

/**
 * Parses events from an object literal grouping, e.g.:
 *   export const NavInteractions = {
 *     /** Fired when user clicks a nav link. *\/
 *     trackClick: createNavEvent<ClickProperties>('click'),
 *   };
 *
 * Supports spreads from other event groups:
 *   export const TemplateInteractions = {
 *     ...NavInteractions,
 *     trackClick: createNavEvent<ClickProperties>('click'), // overrides the spread
 *   };
 *
 * Owner falls back to the containing object's JSDoc `@owner` tag.
 */
const parseEventsFromObjectLiteral = (
  objectLiteral: ObjectLiteralExpression,
  eventNamespaces: Map<string, EventNamespace>
): EventData[] => {
  // Using a Map keyed by fullEventName means direct property assignments silently overwrite spread entries with the same name, mirroring JS spread semantics ({ ...a, foo: 1 } — foo from a is overwritten).
  const eventMap = new Map<string, EventData>();

  for (const property of objectLiteral.getProperties()) {
    if (Node.isSpreadAssignment(property)) {
      // ...NavInteractions: resolve the identifier to its declaration, find the object literal, and recurse.
      const spreadExpr = property.getExpression();
      if (Node.isIdentifier(spreadExpr)) {
        const decl = spreadExpr.getSymbol()?.getDeclarations()?.[0];
        if (decl && Node.isVariableDeclaration(decl)) {
          const spreadInit = decl.getInitializer();
          if (spreadInit && Node.isObjectLiteralExpression(spreadInit)) {
            const spreadEvents = parseEventsFromObjectLiteral(spreadInit, eventNamespaces);
            for (const event of spreadEvents) {
              eventMap.set(event.fullEventName, event);
            }
          }
        }
      }
      continue;
    }

    if (!Node.isPropertyAssignment(property)) {
      continue;
    }

    const value = property.getInitializer();
    if (!value || !Node.isCallExpression(value)) {
      continue;
    }

    const event = parseEventFromCall(value.getType(), value, eventNamespaces, () => {
      return getMetadataFromPropertyComments(property);
    });

    if (event) {
      // Direct assignment — overrides any previously spread event with the same name
      eventMap.set(event.fullEventName, event);
    }
  }

  return [...eventMap.values()];
};

/**
 * Given the type of an event function (e.g. `(props: ClickProperties) => void`),
 * returns the schema of its properties, or undefined if the event takes no properties.
 */
// Reads the TypeScript type system rather than source text to get property names, types, and descriptions.
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

// PropertyAssignment doesn't implement JSDocableNode in ts-morph, so .getJsDocs() isn't available — we parse the raw comment text instead.
const getMetadataFromPropertyComments = (property: PropertyAssignment): { description?: string; owner?: string } => {
  const jsdocRange = property
    .getLeadingCommentRanges()
    .filter((r) => r.getText().startsWith('/**'))
    .at(-1);

  if (!jsdocRange) {
    return {};
  }

  const lines = jsdocRange
    .getText()
    .replace(/^\/\*\*/, '')
    .replace(/\*\/$/, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\*\s?/, '').trim())
    .filter(Boolean);

  let description: string | undefined;
  let owner: string | undefined;

  for (const line of lines) {
    if (line.startsWith('@owner ')) {
      owner = line.slice('@owner '.length).trim();
    } else if (!line.startsWith('@') && description === undefined) {
      description = line;
    }
  }

  return { description, owner };
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
