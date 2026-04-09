import {
  Node,
  type CallExpression,
  type ObjectLiteralExpression,
  type PropertyAssignment,
  type SourceFile,
  type ts,
  type Type,
  type VariableStatement,
} from 'ts-morph';

import type { EventData, EventNamespace, EventPropertySchema } from '../types';

import { getMetadataFromJSDocs, resolveType } from './typeResolution.ts';

/**
 * Finds all events declared in a file. Supports two patterns:
 *
 * Flat declarations:
 *   const trackClick = createNavEvent<ClickProperties>('click');
 *
 * Object groupings:
 *   export const NavInteractions = {
 *     trackClick: createNavEvent<ClickProperties>('click'),
 *   };
 */
export const parseEvents = (file: SourceFile, eventNamespaces: Map<string, EventNamespace>): EventData[] => {
  const events: EventData[] = [];

  for (const variableDecl of file.getVariableDeclarations()) {
    const initializer = variableDecl.getInitializer();
    if (!initializer) {
      continue;
    }

    if (Node.isCallExpression(initializer)) {
      const event = parseEventFromCall(variableDecl.getType(), initializer, eventNamespaces, () => {
        const parent = getParentVariableStatement(variableDecl);
        if (!parent) {
          throw new Error(`Parent not found for ${variableDecl.getText()}`);
        }
        return getMetadataFromJSDocs(parent.getJsDocs());
      });
      if (event) {
        events.push(event);
      }
    } else if (Node.isObjectLiteralExpression(initializer)) {
      const parent = getParentVariableStatement(variableDecl);
      const { owner: groupOwner } = parent ? getMetadataFromJSDocs(parent.getJsDocs()) : {};
      events.push(...parseEventsFromObjectLiteral(initializer, eventNamespaces, groupOwner));
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

  const { description, owner } = getMetadata();
  if (!description) {
    throw new Error(`Description not found for event '${arg.getLiteralText()}'`);
  }

  const eventName = arg.getLiteralText();
  return {
    fullEventName: `${eventNamespace.eventPrefixProject}_${eventNamespace.eventPrefixFeature}_${eventName}`,
    repo: eventNamespace.eventPrefixProject,
    feature: eventNamespace.eventPrefixFeature,
    eventName,
    description,
    owner,
    properties: resolveEventProperties(type),
  };
};

/**
 * Parses events from an object literal grouping, e.g.:
 *   export const NavInteractions = {
 *     /** Fired when user clicks a nav link. *\/
 *     trackClick: createNavEvent<ClickProperties>('click'),
 *   };
 *
 * Owner falls back to the containing object's JSDoc `@owner` tag.
 */
const parseEventsFromObjectLiteral = (
  objectLiteral: ObjectLiteralExpression,
  eventNamespaces: Map<string, EventNamespace>,
  groupOwner: string | undefined
): EventData[] => {
  const events: EventData[] = [];

  for (const property of objectLiteral.getProperties()) {
    if (!Node.isPropertyAssignment(property)) {
      continue; // skip spread assignments like ...NavInteractions
    }

    const value = property.getInitializer();
    if (!value || !Node.isCallExpression(value)) {
      continue;
    }

    const event = parseEventFromCall(value.getType(), value, eventNamespaces, () => {
      const { description, owner } = getMetadataFromPropertyComments(property);
      return { description, owner: owner ?? groupOwner };
    });

    if (event) {
      events.push(event);
    }
  }

  return events;
};

/**
 * Given the type of an event function (e.g. `(props: ClickProperties) => void`),
 * returns the schema of its properties, or undefined if the event takes no properties.
 */
const resolveEventProperties = (type: Type): EventPropertySchema[] | undefined => {
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

/**
 * PropertyAssignment doesn't implement JSDocableNode in ts-morph, so we parse
 * the leading comment ranges directly to extract description and @owner.
 */
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
