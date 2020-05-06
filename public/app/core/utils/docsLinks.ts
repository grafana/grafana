import { DocsId } from '@grafana/data';

// TODO: Documentation links
const DOCS_LINKS: Record<DocsId, string> = {
  [DocsId.Transformations]: 'https://docs.grafana.com',
  [DocsId.FieldConfig]: 'https://docs.grafana.com',
  [DocsId.FieldConfigOverrides]: 'https://docs.grafana.com',
};

export const getDocsLink = (id: DocsId) => DOCS_LINKS[id];
