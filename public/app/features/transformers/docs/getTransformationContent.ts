import { transformationDocsContent, getLinkToDocs } from './content';

export function getTransformationContent(id: string) {
  if (id in transformationDocsContent) {
    const { name, helperDocs } = transformationDocsContent[id];
    return {
      name,
      content: `
      ${helperDocs}
      ${getLinkToDocs()}
      `,
    };
  }

  return {
    name: 'No documentation found',
    content: getLinkToDocs(),
  };
}
