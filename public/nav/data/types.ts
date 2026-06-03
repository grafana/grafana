export interface NavPersonaConfig {
  profileName: string;
  // Nav item ids to pin, in display order. Ids may reference sub-menu items
  // (e.g. 'connections-datasources') as well as top-level sections.
  orderedPins: string[];
}
