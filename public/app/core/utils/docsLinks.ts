import { DocsId } from '@grafana/data';

// TODO: Documentation links
const DOCS_LINKS: Record<DocsId, string> = {
  [DocsId.Transformations]: 'https://grafana.com/docs/grafana/latest/panels/transformations',
  [DocsId.FieldConfig]: 'https://grafana.com/docs/grafana/latest/panels/field-configuration-options/',
  [DocsId.FieldConfigOverrides]:
    'https://grafana.com/docs/grafana/latest/panels/field-configuration-options/#override-a-field',
};

export const getDocsLink = (id: DocsId) => DOCS_LINKS[id];
