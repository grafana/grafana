import { transformationDocsContent, getLinkToDocs, TransformationInfo } from './content';

export function getTransformationContent(id: string): TransformationInfo {
  if (id in transformationDocsContent) {
    const { name, helperDocs, links } = transformationDocsContent[id];

    if (links?.length) {
      return {
        name,
        helperDocs: `
        ${helperDocs}
        ${getLinkToDocs()}
  ${links.map((link) => `<a href="${link.url}" target="_blank">${link.title}</a>`)}
        `,
      };
    }

    return {
      name,
      helperDocs: `
      ${helperDocs}
      ${getLinkToDocs()}
      `,
    };
  }

  return {
    name: 'No documentation found',
    helperDocs: getLinkToDocs(),
  };
}
