import { Project, Node, type SourceFile, SyntaxKind, type JSDoc, type Type } from 'ts-morph';
import util from 'util';
import path from 'path';

/**
 * The goal of this script is to find all analytics events that are defined and output a report
 * of the events, their description, and the properties they accept.
 *
 * Events look like:
 *     const createUnifiedHistoryEvent = createEventFactory('grafana', 'unified_history');
 *
 *     interface UnifiedHistoryEntryClicked {
 *       /** We will also work with the current URL but we will get this from Rudderstack data * /
 *       entryURL: string;
 *
 *       /** In the case we want to go back to a specific query param, currently just a specific time range * /
 *       subEntry?: subEntryTypes;
 *     }
 *
 *     /** Triggered when a user clicks on an entry in the unified history list * /
 *     export const unifiedHistoryEntryClicked = createUnifiedHistoryEvent<UnifiedHistoryEntryClicked>('entry_clicked');
 *
 * This defines an event called grafana_unified_history_entry_clicked.
 * It should be able to handle imports with either absolute or relative paths.
 * It should also be able to handle aliased imports.
 * It should be able to handle multiple namespaces (from multiple calls to createEventFactory) in the same file.
 */

// User-supplied path where `createEventFactory` is defined (relative to project root)
const createEventFactoryPath = path.resolve('public/app/core/services/echo/Echo.ts');
const tsConfigPath = path.resolve('tsconfig.json');

console.log('Creating project');
const project = new Project({
  tsConfigFilePath: tsConfigPath,
});

console.log('Getting source files');
// const files = project.getSourceFiles(['public/**/*.ts', 'public/**/*.tsx']);
const files = project.getSourceFiles(['public/app/core/components/AppChrome/History/*.ts']);

/**
 * Gets the name of the `createEventFactory` function imported from the correct file
 */
function getEventFactoryFunctionName(file: SourceFile): string | undefined {
  const imports = file.getImportDeclarations();

  /**
   * - Loop through all the imports
   * - Find the import for `createEventFactory`
   * - Check if it's imported from `Echo.ts` (and not just another file with the same export)
   * - Return the name of the function imported or aliased
   */
  for (const importDeclaration of imports) {
    const namedImports = importDeclaration.getNamedImports();

    for (const namedImport of namedImports) {
      const importName = namedImport.getName();

      if (importName === 'createEventFactory') {
        const moduleSpecifier = importDeclaration.getModuleSpecifierSourceFile();
        if (!moduleSpecifier) continue;

        if (moduleSpecifier.getFilePath() === createEventFactoryPath) {
          return namedImport.getAliasNode()?.getText() || importName;
        }
      }
    }
  }

  return undefined;
}

interface EventNamespace {
  factoryName: string;
  prefixRepo: string;
  prefixFeature: string;
}

interface EventProperty {
  name: string;
  type: string;
  description?: string;
}

interface Event {
  name: string;
  description: string;
  owner?: string;
  properties?: EventProperty[];
}

const allEvents: Event[] = [];

for (const file of files) {
  // if (!file.getFilePath().includes('copy.ts')) continue;

  console.log('---');
  const createEventFactoryImportedName = getEventFactoryFunctionName(file);
  if (!createEventFactoryImportedName) continue;

  console.log(`${file.getFilePath()}: ${createEventFactoryImportedName}`);

  const variableDecls = file.getVariableDeclarations();

  const eventNamespaces = new Map<string, EventNamespace>();

  // Find all createEventFactory() calls
  for (const variableDecl of variableDecls) {
    const eventFactoryName = variableDecl.getName();

    const initializer = variableDecl.getInitializer();
    if (!initializer) continue;
    if (!Node.isCallExpression(initializer)) continue;

    const initializerFnName = initializer.getExpression().getText();
    if (initializerFnName !== createEventFactoryImportedName) continue;

    const args = initializer.getArguments();
    if (args.length !== 2) {
      throw new Error(`Expected ${createEventFactoryImportedName} to have 2 arguments`);
    }

    const [argA, argB] = args;

    if (!Node.isStringLiteral(argA) || !Node.isStringLiteral(argB)) {
      throw new Error(`Expected ${createEventFactoryImportedName} to have 2 string arguments`);
    }

    const eventPrefixRepo = argA.getLiteralText();
    const eventPrefixFeature = argB.getLiteralText();

    console.log(
      `found where ${createEventFactoryImportedName} is called, ${eventFactoryName} = ${eventPrefixRepo}_${eventPrefixFeature}`
    );

    eventNamespaces.set(eventFactoryName, {
      factoryName: eventFactoryName,
      prefixRepo: eventPrefixRepo,
      prefixFeature: eventPrefixFeature,
    });
  }

  // console.log(eventNamespaces);

  // Find all the events defined in the file
  for (const variableDecl of variableDecls) {
    const initializer = variableDecl.getInitializer();
    if (!initializer) continue;
    if (!Node.isCallExpression(initializer)) continue;

    const initializerFnName = initializer.getExpression().getText();
    if (!eventNamespaces.has(initializerFnName)) continue;

    const eventNamespace = eventNamespaces.get(initializerFnName);
    if (!eventNamespace) throw new Error(`Event namespace not found for ${initializerFnName}`);

    const args = initializer.getArguments();
    if (args.length !== 1) {
      throw new Error(`Expected ${initializerFnName} to be called with only 1 argument`);
    }

    const arg = args[0];
    if (!Node.isStringLiteral(arg)) {
      throw new Error(`Expected ${initializerFnName} to be called with a string argument`);
    }

    const eventName = arg.getLiteralText();

    // console.log(`\nEVENT: ${eventNamespace.prefixRepo}_${eventNamespace.prefixFeature}_${eventName}`);

    let parent: Node | undefined = variableDecl.getParent();
    while (parent && !Node.isVariableStatement(parent)) {
      parent = parent.getParent();
    }

    if (!parent) throw new Error(`Parent not found for ${variableDecl.getText()}`);

    const docs = parent.getJsDocs();

    // TODO: get default owner from the CODEOWNERS file
    const { description, owner } = getMetadataFromJSDocs(docs);

    if (!description) {
      throw new Error(`Description not found for ${variableDecl.getText()}`);
    }

    const fullEventName = `${eventNamespace.prefixRepo}_${eventNamespace.prefixFeature}_${eventName}`;
    const event: Event = {
      name: fullEventName,
      description,
      owner,
    };
    allEvents.push(event);

    console.log('\nEvent:', fullEventName);
    console.log('  Description: ', description);
    console.log('  Owner: ', owner);

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
      console.log('  Properties:');
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
        console.log(`    ${property.getName()}: ${resolvedType} - ${description}`);
        event.properties.push({
          name: property.getName(),
          type: resolvedType,
          description,
        });
      }
    } else if (!parameterType.isVoid()) {
      // void type is allowed, but we don't need to report anything
      throw new Error(`Expected parameter type to be an object or void, got ${parameterType.getText()}`);
    }
  }
}

console.log(util.inspect(allEvents, { depth: null, colors: true }));

// Function to fully resolve types (aliases, unions, literals)
function resolveType(type: Type): string {
  // Step 1: If the type is an alias (e.g., `Action`), resolve its declaration
  const aliasSymbol = type.getAliasSymbol();
  if (aliasSymbol) {
    const aliasType = type.getSymbol()?.getDeclarations()?.[0]?.getType();
    if (aliasType) {
      return resolveType(aliasType);
    }
  }

  // Step 2: If it's a union type, resolve each member recursively
  if (type.isUnion()) {
    return type
      .getUnionTypes()
      .map((t) => resolveType(t))
      .join(' | ');
  }

  // Step 3: If it's a string literal type, return its literal value
  if (type.isStringLiteral()) {
    return `"${type.getLiteralValue()}"`;
  }

  return type.getText(); // Default to the type's text representation
}

interface JSDocMetadata {
  description?: string;
  owner?: string;
}

function getMetadataFromJSDocs(docs: JSDoc[]): JSDocMetadata {
  let description: string | undefined;
  let owner: string | undefined;

  if (docs.length > 1) {
    throw new Error('Expected only one JSDoc comment (not sure why/how you can have multiple)');
  }

  for (const doc of docs) {
    const desc = doc.getDescription().trim().replace(/\n/g, ' ');
    if (desc) description = desc;

    const tags = doc.getTags();
    for (const tag of tags) {
      if (tag.getTagName() === 'owner') {
        owner = tag.getCommentText()?.trim();
      }
    }
  }

  return { description, owner };
}
