import { transformationDocsContent, getLinkToDocs, ImageRenderType } from './content';

export function getTransformationContent(id: string): { name: string; helperDocs: string } {
  if (id in transformationDocsContent) {
    const { name, getHelperDocs, links } = transformationDocsContent[id];

    const helperDocs = getHelperDocs(ImageRenderType.UIImage);

    const cleansedMarkdown = cleanMarkdownOfUnwantedSyntax(helperDocs);

    // NOTE: string interpolation whitespace/indentation formatting is intentional.
    if (links?.length) {
      const renderedLinks = links
        .map((link) => {
          return `
  Or visit <a href="${link.url}" target="_blank">${link.title}</a>\n
  `;
        })
        .join('');

      // If external links exist, build and add them to the returned documentation.
      return {
        name,
        helperDocs: `
        ${cleansedMarkdown}
        ${getLinkToDocs()}
  ${renderedLinks}
        `,
      };
    }

    // If NO external links exist, simply return the basic documentation.
    return {
      name,
      helperDocs: `
      ${cleansedMarkdown}
      ${getLinkToDocs()}
      `,
    };
  }

  // If the transformation has no documentation, return an external link to the online documentation.
  return {
    name: 'No documentation found',
    helperDocs: getLinkToDocs(),
  };
}

const cleanMarkdownOfUnwantedSyntax = (markdown: string) => {
  // Remove anchor links: [text](#link)
  const markdownWithoutAnchorLinks = markdown.replace(/\[(.*?)\]\(#.*?\)/g, '$1');

  // Remove shortcode syntax: [text][]
  const markdownWithoutShortcodeSyntax = markdownWithoutAnchorLinks.replace(/\[[^\]]*\]\[\]/g, '');

  return markdownWithoutShortcodeSyntax;
};
