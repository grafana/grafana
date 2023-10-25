import { transformationDocsContent, getLinkToDocs } from './content';

export function getTransformationContent(id: string): { name: string; helperDocs: string } {
  if (id in transformationDocsContent) {
    const { name, getHelperDocs, links } = transformationDocsContent[id];

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
        ${getHelperDocs()}
        ${getLinkToDocs()}
  ${renderedLinks}
        `,
      };
    }

    return {
      name,
      helperDocs: `
      ${getHelperDocs()}
      ${getLinkToDocs()}
      `,
    };
  }

  return {
    name: 'No documentation found',
    helperDocs: getLinkToDocs(),
  };
}
