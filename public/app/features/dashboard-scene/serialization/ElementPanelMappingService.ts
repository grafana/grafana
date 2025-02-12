// function to manage a lookup table that will hold element_identifer : panel_id

// function to manage a lookup table that will hold element_identifer : panel_id
export interface ElementPanelMapping {
  [elementIdentifier: string]: number;
}

export class ElementPanelMappingService {
  private static instance: ElementPanelMappingService;
  private mapping: ElementPanelMapping = {};

  private constructor() {}

  public static getInstance(): ElementPanelMappingService {
    if (!ElementPanelMappingService.instance) {
      ElementPanelMappingService.instance = new ElementPanelMappingService();
    }
    return ElementPanelMappingService.instance;
  }

  // Add or update a mapping
  public set(elementIdentifier: string, panelId: number): void {
    this.mapping[elementIdentifier] = panelId;
    console.log('adding or updating mapping', elementIdentifier, panelId);
    console.log('new mapping in set:', this.mapping);
  }

  // Get panel ID for an element identifier
  public getPanelId(elementIdentifier: string): number | undefined {
    return this.mapping[elementIdentifier];
  }

  // Get element identifier for a panel ID
  public getElementIdentifier(panelId: number): string | undefined {
    return Object.entries(this.mapping).find(([_, id]) => id === panelId)?.[0];
  }

  // Remove a mapping
  public remove(elementIdentifier: string): void {
    delete this.mapping[elementIdentifier];
    console.log('removing element identifier', elementIdentifier);

    console.log('new mapping in remove:', this.mapping);
  }

  // Clear all mappings
  public clear(): void {
    this.mapping = {};
  }

  // Get all mappings
  public getAll(): ElementPanelMapping {
    return { ...this.mapping };
  }

  // Check if element identifier exists
  public hasElement(elementIdentifier: string): boolean {
    return elementIdentifier in this.mapping;
  }

  // Check if panel ID exists
  public hasPanelId(panelId: number): boolean {
    return Object.values(this.mapping).includes(panelId);
  }
}
