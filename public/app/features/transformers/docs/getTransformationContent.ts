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

      // If links exist, build and add them to the returned documentation.
      return {
        name,
        helperDocs: `
        ${getHelperDocs()}
        ${getLinkToDocs()}
  ${renderedLinks}
        `,
      };
    }

    // If NO links exist, simply return the basic documentation.
    return {
      name,
      helperDocs: `
      ${getHelperDocs()}
      ${getLinkToDocs()}
      `,
    };
  }

  // If the transformation has no documentation, return a link to the online documentation.
  return {
    name: 'No documentation found',
    helperDocs: getLinkToDocs(),
  };
}
