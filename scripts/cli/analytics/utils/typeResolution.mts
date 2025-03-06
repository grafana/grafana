import { type JSDoc, type Type } from 'ts-morph';

/**
 * Resolves a TypeScript type to a string representation. For example for:
 *   type Action = "click" | "hover"
 * `Action` resolves to `"click" | "hover"`
 *
 * @param type  Type to resolve
 * @returns String representation of the type
 */
export function resolveType(type: Type): string {
  // If the type is an alias (e.g., `Action`), resolve its declaration
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

  // TODO: handle enums. Would want to represent an enum as a union of its values

  return type.getText(); // Default to the type's text representation
}

export interface JSDocMetadata {
  description?: string;
  owner?: string;
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
    // TODO: Do we need to handle multiple JSDoc comments? Why would there be more than one?
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

function trimString(str: string): string {
  return str.trim().replace(/\n/g, ' ');
}
