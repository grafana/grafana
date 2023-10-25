import { transformationDocsContent, getLinkToDocs, ImageRenderType } from './content';

export function getTransformationContent(id: string): { name: string; helperDocs: string } {
  if (id in transformationDocsContent) {
    const { name, getHelperDocs, links } = transformationDocsContent[id];

    const cleansedMarkdown = removeMarkdownAnchorLinks(getHelperDocs(ImageRenderType.UIImage));

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
        ${cleansedMarkdown}
        ${getLinkToDocs()}
  ${renderedLinks}
        `,
      };
    }

    // If NO links exist, simply return the basic documentation.
    return {
      name,
      helperDocs: `
      ${cleansedMarkdown}
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

const removeMarkdownAnchorLinks = (markdown: string) => {
  // Define the regular expression pattern to match the [text](#text-text-text) pattern
  const pattern = /\[(.*?)\]\(#.*?\)/g;

  // Replace all occurrences of the pattern with the captured "text" part
  const result = markdown.replace(pattern, '$1');

  return result;
};
