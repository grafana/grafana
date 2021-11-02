var _a;
import { DocsId } from '@grafana/data';
// TODO: Documentation links
var DOCS_LINKS = (_a = {},
    _a[DocsId.Transformations] = 'https://grafana.com/docs/grafana/latest/panels/transformations',
    _a[DocsId.FieldConfig] = 'https://grafana.com/docs/grafana/latest/panels/field-configuration-options/',
    _a[DocsId.FieldConfigOverrides] = 'https://grafana.com/docs/grafana/latest/panels/field-configuration-options/#override-a-field',
    _a);
export var getDocsLink = function (id) { return DOCS_LINKS[id]; };
//# sourceMappingURL=docsLinks.js.map