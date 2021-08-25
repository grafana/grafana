// Moved to `@grafana/schema`, in Grafana 9, this will be removed
//---------------------------------------------------------------
// grafana/grafana/packages/grafana-schema$ grep export src/schema/*.ts
/**
 * @deprecated Moved to `@grafana/schema` package and will be removed in Grafana 9
 * @public
 */
export {
  // Styles that changed
  VizTextDisplayOptions as TextDisplayOptions, // rename
} from '@grafana/schema';
