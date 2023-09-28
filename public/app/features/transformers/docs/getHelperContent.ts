import { transformationDocsContent, getLinkToDocs } from './content';

export function getHelperContent(id: string): string {
  if (id in transformationDocsContent) {
    return `
    ${transformationDocsContent[id].content}
    ${getLinkToDocs()}
    `;
  }

  return getLinkToDocs();
}
