import type {
  CallExpression,
  Identifier,
  JSXAttribute,
  JSXElement,
  JSXExpressionContainer,
  JSXText,
  KeyValueProperty,
  Node,
  ObjectExpression,
  StringLiteral,
} from '@swc/core';

export function isIdentifier(node: Node | null | undefined): node is Identifier {
  return node?.type === 'Identifier';
}

export function isStringLiteral(node: Node | null | undefined): node is StringLiteral {
  return node?.type === 'StringLiteral';
}

export function isObjectExpression(node: Node | null | undefined): node is ObjectExpression {
  return node?.type === 'ObjectExpression';
}

export function isKeyValueProperty(node: Node | null | undefined): node is KeyValueProperty {
  return node?.type === 'KeyValueProperty';
}

export function isJSXText(node: Node | null | undefined): node is JSXText {
  return node?.type === 'JSXText';
}

export function isJSXExpressionContainer(node: Node | null | undefined): node is JSXExpressionContainer {
  return node?.type === 'JSXExpressionContainer';
}

export function isJSXElement(node: Node | null | undefined): node is JSXElement {
  return node?.type === 'JSXElement';
}

export function isJSXAttribute(node: Node | null | undefined): node is JSXAttribute {
  return node?.type === 'JSXAttribute';
}

export function isCallExpression(node: Node | null | undefined): node is CallExpression {
  return node?.type === 'CallExpression';
}
