import { transformationDocsContent, getLinkToDocs } from './content';

export function getTransformationContent(id: string) {
  if (id in transformationDocsContent) {
    const { name, content } = transformationDocsContent[id];
    return {
      name,
      content: `
      ${content}
      ${getLinkToDocs()}
      `,
    };
  }

  return {
    name: 'No documentation found',
    content: getLinkToDocs(),
  };
}
