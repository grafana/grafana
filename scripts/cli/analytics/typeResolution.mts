import { Node, createWrappedNode, type JSDoc, type Node as TsMorphNode, type Type, type ts } from 'ts-morph';
import type { JSDocMetadata } from './types.mts';

/**
 * Resolves a TypeScript type to a string representation. For example for:
 *   type Action = "click" | "hover"
 * `Action` resolves to `"click" | "hover"`
 *
 * @param type  Type to resolve
 * @returns String representation of the type
 */
export function resolveType(type: Type): string {
  // If the type is an enum, resolve it to a union of its values
  if (type.isEnum()) {
    const enumDecl = type.getSymbol()?.getDeclarations()?.[0];
    if (!enumDecl || !Node.isEnumDeclaration(enumDecl)) {
      return type.getText();
    }
    return enumDecl
      .getMembers()
      .map((m) => {
        const value = m.getValue();
        return typeof value === 'string' ? `"${value}"` : String(value);
      })
      .join(' | ');
  }
  // If the type is an alias (e.g., `Action`), resolve its declaration
  const aliasSymbol = type.getAliasSymbol();
  if (aliasSymbol) {
    const aliasType = type.getSymbol()?.getDeclarations()?.[0]?.getType();
    if (aliasType) {
      return resolveType(aliasType);
    }
  }

  // If it's an array type, resolve the element type and append []
  if (type.isArray()) {
    return `${resolveType(type.getArrayElementTypeOrThrow())}[]`;
  }

  // If it's a union type, resolve each member recursively
  if (type.isUnion()) {
    return type
      .getUnionTypes()
      .map((t) => resolveType(t))
      .join(' | ');
  }

  // If it's a string literal type, return its literal value
  if (type.isStringLiteral()) {
    return `"${type.getLiteralValue()}"`;
  }

  // Without this, mapped types like Exact<P, A> make properties look like A["key"]
  // in the report instead of their actual type. Getting the constraint resolves that.
  const constraint = type.getConstraint();
  if (constraint) {
    return resolveType(constraint);
  }

  return type.getText(); // Default to the type's text representation
}

/**
 * Extracts description and owner from a JSDoc comment.
 *
 * @param docs JSDoc comment nodes to extract metadata from
 * @returns Metadata extracted from the JSDoc comments
 */
export function getMetadataFromJSDocs(docs: JSDoc[]): JSDocMetadata {
  let description: string | undefined;
  let owner: string | undefined;

  if (docs.length > 1) {
    // TypeScript allows stacking JSDoc blocks but we treat that as a bug in the event definition.
    throw new Error('Expected only one JSDoc comment');
  }

  for (const doc of docs) {
    const desc = trimString(doc.getDescription());
    if (desc) {
      description = desc;
    }

    const tags = doc.getTags();
    for (const tag of tags) {
      if (tag.getTagName() === 'owner') {
        const tagText = tag.getCommentText();
        owner = tagText && trimString(tagText);
      }
    }
  }

  return { description, owner };
}

// ts-morph doesn't expose getJsDocs on all node types, even if it's there on the underlying Typescript
// compiler node. So we have to check for it ourselves and wrap if needed.
function hasJsDocNodes(node: ts.Node): node is ts.Node & { jsDoc: ts.NodeArray<ts.JSDoc> } {
  return 'jsDoc' in node;
}

export function getJsDocsFromNode(node: TsMorphNode): JSDoc[] {
  if (Node.isJSDocable(node)) {
    return node.getJsDocs();
  }

  if (hasJsDocNodes(node.compilerNode)) {
    return [...node.compilerNode.jsDoc].map((doc) => createWrappedNode(doc));
  }
  return [];
}

function trimString(str: string): string {
  return str.trim().replace(/\n/g, ' ');
}
