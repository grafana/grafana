import { Node, type SourceFile } from 'ts-morph';

import type { Event, EventNamespace } from './types.mts';
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

    const eventName = arg.getLiteralText();

    let parent: Node | undefined = variableDecl.getParent();
    while (parent && !Node.isVariableStatement(parent)) {
      parent = parent.getParent();
    }

    if (!parent) {
      throw new Error(`Parent not found for ${variableDecl.getText()}`);
    }

    const docs = parent.getJsDocs();
    const { description, owner } = getMetadataFromJSDocs(docs);

    if (!description) {
      throw new Error(`Description not found for ${variableDecl.getText()}`);
    }

    const fullEventName = `${eventNamespace.eventPrefixProject}_${eventNamespace.eventPrefixFeature}_${eventName}`;
    const event: Event = {
      name: fullEventName,
      description,
      owner,
    };

    // Get the function type and its first argument type
    const typeAnnotation = variableDecl.getType();
    const callSignatures = typeAnnotation.getCallSignatures();
    if (callSignatures.length === 0) {
      const typeAsText = typeAnnotation.getText();
      throw new Error(`Expected type to be a function, got ${typeAsText}`);
    }

    const functionType = callSignatures[0];
    const parameters = functionType.getParameters();
    if (parameters.length !== 1) {
      throw new Error('Expected function to have one parameter');
    }

    const parameter = parameters[0];
    const parameterType = parameter.getTypeAtLocation(parameter.getDeclarations()[0]);

    if (parameterType.isObject()) {
      event.properties = [];

      const properties = parameterType.getProperties();
      for (const property of properties) {
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
        event.properties.push({
          name: property.getName(),
          type: resolvedType,
          description,
        });
      }
    } else if (!parameterType.isVoid()) {
      throw new Error(`Expected parameter type to be an object or void, got ${parameterType.getText()}`);
    }

    events.push(event);
  }

  return events;
}
