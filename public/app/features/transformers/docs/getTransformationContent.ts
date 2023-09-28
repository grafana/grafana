import { transformationDocsContent, getLinkToDocs, TransformationInfo } from './content';

export function getTransformationContent(id: string): TransformationInfo {
  if (id in transformationDocsContent) {
    const { name, helperDocs } = transformationDocsContent[id];
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
