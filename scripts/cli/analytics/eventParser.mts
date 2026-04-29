import path from 'path';

import {
  Node,
  SyntaxKind,
  type CallExpression,
  type ObjectLiteralExpression,
  type SourceFile,
  type ts,
  type Type,
  type VariableStatement,
} from 'ts-morph';

import type { EventData, EventNamespace, EventPropertySchema } from './types.mts';

import { getMetadataFromJSDocs, getMetadataFromPropertyComments, resolveType } from './typeResolution.mts';
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
export const parseEvents = (file: SourceFile, eventNamespaces: Map<string, EventNamespace>): EventData[] => {
  const flatEvents: EventData[] = [];
  // Keyed by ObjectLiteralExpression, then by property name (e.g. 'itemClicked').
  // Built in the CallExpression scan; consumed by resolveGroupedEvents for spread resolution.
  const directEventsByObject = new Map<ObjectLiteralExpression, Map<string, EventData>>();
  // CODEOWNERS matching requires a path relative to the repo root
  const relativeFilePath = path.relative(process.cwd(), file.getFilePath());

  for (const callExpr of file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const fnName = callExpr.getExpression().getText();
    if (!eventNamespaces.has(fnName)) {
      continue;
    }

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
        flatEvents.push(event);
      }
    } else if (Node.isPropertyAssignment(parent)) {
      // Grouped object pattern: const Interactions = { trackClick: createNavEvent('click') }
      const objectLiteral = parent.getParent();
      if (!Node.isObjectLiteralExpression(objectLiteral)) {
        continue;
      }

      const event = parseEventFromCall(callExpr.getType(), callExpr, eventNamespaces, () =>
        getMetadataFromPropertyComments(parent)
      );

      if (event) {
        if (!directEventsByObject.has(objectLiteral)) {
          directEventsByObject.set(objectLiteral, new Map());
        }
        directEventsByObject.get(objectLiteral)!.set(parent.getName(), event);
      }
    }
  }

  const allEvents = [...flatEvents, ...resolveGroupedEvents(directEventsByObject)];

  for (const event of allEvents) {
    if (!event.owner) {
      event.owner = resolveOwner(relativeFilePath);
    }
  }

  return allEvents;
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
 * Merges directly-declared events with any spread sources, respecting source order so that
 * later property assignments override earlier ones — mirroring JS spread semantics.
*/
const resolveGroupedEvents = (
  directEventsByObject: Map<ObjectLiteralExpression, Map<string, EventData>>
): EventData[] => {
  const result: EventData[] = [];

  for (const [objectLiteral, directEvents] of directEventsByObject) {
    if (!objectLiteral.getProperties().some(Node.isSpreadAssignment)) {
      result.push(...directEvents.values());
      continue;
    }

    // Walk properties in source order so that later entries override earlier ones.
    const merged = new Map<string, EventData>();

    for (const property of objectLiteral.getProperties()) {
      if (Node.isSpreadAssignment(property)) {
        const spreadExpr = property.getExpression();
        if (Node.isIdentifier(spreadExpr)) {
          const decl = spreadExpr.getSymbol()?.getDeclarations()?.[0];
          if (decl && Node.isVariableDeclaration(decl)) {
            const spreadInit = decl.getInitializer();
            if (spreadInit && Node.isObjectLiteralExpression(spreadInit)) {
              const spreadEvents = directEventsByObject.get(spreadInit);
              if (spreadEvents) {
                for (const [key, event] of spreadEvents) {
                  merged.set(key, event);
                }
              }
            }
          }
        }
      } else if (Node.isPropertyAssignment(property)) {
        const event = directEvents.get(property.getName());
        if (event) {
          merged.set(property.getName(), event);
        }
      }
    }

    result.push(...merged.values());
  }

  return result;
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
