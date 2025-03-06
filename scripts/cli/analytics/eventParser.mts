import { Node, type SourceFile, type ts, type Type, type VariableStatement } from 'ts-morph';

import type { Event, EventNamespace, EventProperty } from './types.mts';
import { resolveType, getMetadataFromJSDocs } from './utils/typeResolution.mts';

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
 */
export function parseEvents(file: SourceFile, eventNamespaces: Map<string, EventNamespace>): Event[] {
  const events: Event[] = [];
  const variableDecls = file.getVariableDeclarations();

  for (const variableDecl of variableDecls) {
    // Get the initializer (right hand side of `=`) of the variable declaration
    // and make sure it's a function call
    const initializer = variableDecl.getInitializer();
    if (!initializer || !Node.isCallExpression(initializer)) {
      continue;
    }

    // Only interested in calls to functions returned by createEventFactory
    const initializerFnName = initializer.getExpression().getText();
    const eventNamespace = eventNamespaces.get(initializerFnName);
    if (!eventNamespace) {
      continue;
    }

    // Events should be defined with a single string literal argument (e.g. createNavEvent('click'))
    const [arg, ...restArgs] = initializer.getArguments();
    if (!arg || !Node.isStringLiteral(arg) || restArgs.length > 0) {
      throw new Error(`Expected ${initializerFnName} to be called with only 1 string literal argument`);
    }

    // We're currently using the variable declaration (foo = blah), but we need the variable
    // statement (const foo = blah) to get the JSDoc nodes
    const parent = getParentVariableStatement(variableDecl);
    if (!parent) {
      throw new Error(`Parent not found for ${variableDecl.getText()}`);
    }

    const docs = parent.getJsDocs();
    const { description, owner } = getMetadataFromJSDocs(docs); // TODO: default owner to codeowner if not found
    if (!description) {
      throw new Error(`Description not found for ${variableDecl.getText()}`);
    }

    const eventName = arg.getLiteralText();
    const event: Event = {
      fullEventName: `${eventNamespace.eventPrefixProject}_${eventNamespace.eventPrefixFeature}_${eventName}`,
      eventProject: eventNamespace.eventPrefixProject,
      eventFeature: eventNamespace.eventPrefixFeature,
      eventName,

      description,
      owner,
    };

    // Get the type of the declared variable and assert it's a function
    const typeAnnotation = variableDecl.getType();
    const [callSignature, ...restCallSignatures] = typeAnnotation.getCallSignatures();
    if (callSignature === undefined || restCallSignatures.length > 0) {
      const typeAsText = typeAnnotation.getText();
      throw new Error(`Expected type to be a function with one call signature, got ${typeAsText}`);
    }

    // The function always only have one parameter type.
    // Events that have no properties will have a void parameter type.
    const [parameter, ...restParameters] = callSignature.getParameters();
    if (parameter === undefined || restParameters.length > 0) {
      throw new Error('Expected function to have one parameter');
    }

    // Find where the parameter type was declared and get it's type
    const parameterType = parameter.getTypeAtLocation(parameter.getDeclarations()[0]);

    // Then describe the schema for the parameters the event function is called with
    if (parameterType.isObject()) {
      event.properties = describeObjectParameters(parameterType);
    } else if (!parameterType.isVoid()) {
      throw new Error(`Expected parameter type to be an object or void, got ${parameterType.getText()}`);
    }

    events.push(event);
  }

  return events;
}

function getParentVariableStatement(node: Node): VariableStatement | undefined {
  let parent: Node | undefined = node.getParent();
  while (parent && !Node.isVariableStatement(parent)) {
    parent = parent.getParent();
  }

  if (parent && Node.isVariableStatement(parent)) {
    return parent;
  }

  return undefined;
}

function describeObjectParameters(objectType: Type<ts.ObjectType>): EventProperty[] {
  const properties = objectType.getProperties().map((property) => {
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

  return properties;
}
