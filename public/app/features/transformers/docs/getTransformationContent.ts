import { transformationDocsContent, getLinkToDocs, TransformationInfo } from './content';

export function getTransformationContent(id: string): TransformationInfo {
  if (id in transformationDocsContent) {
    const { name, helperDocs, links } = transformationDocsContent[id];

    if (links?.length) {
      const renderedLinks = links
        .map((link) => {
          return `
  Or visit <a href="${link.url}" target="_blank">${link.title}</a>\n
  `;
        })
        .join('');

      return {
        name,
        helperDocs: `
        ${helperDocs}
        ${getLinkToDocs()}
  ${renderedLinks}
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
