import { type SyntaxNode } from '@lezer/common';

export function childrenOf(node: SyntaxNode): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    out.push(child);
  }
  return out;
}

export function firstChildOfType(node: SyntaxNode, names: ReadonlySet<string> | string): SyntaxNode | undefined {
  const matches = typeof names === 'string' ? (name: string) => name === names : (name: string) => names.has(name);
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (matches(child.type.name)) {
      return child;
    }
  }
  return undefined;
}

export function childrenOfType(node: SyntaxNode, names: ReadonlySet<string>): SyntaxNode[] {
  return childrenOf(node).filter((child) => names.has(child.type.name));
}
