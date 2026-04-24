import { Node, type JSDoc, type PropertyAssignment, type Type } from 'ts-morph';

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

// PropertyAssignment doesn't implement JSDocableNode in ts-morph, so .getJsDocs() isn't available — we parse the raw comment text instead.
export function getMetadataFromPropertyComments(property: PropertyAssignment): JSDocMetadata {
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
}

function trimString(str: string): string {
  return str.trim().replace(/\n/g, ' ');
}
