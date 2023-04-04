export interface AzureLogAnalyticsMetadata {
  functions: AzureLogAnalyticsMetadataFunction[];
  resourceTypes: AzureLogAnalyticsMetadataResourceType[];
  tables: AzureLogAnalyticsMetadataTable[];
  solutions: AzureLogAnalyticsMetadataSolution[];
  workspaces: AzureLogAnalyticsMetadataWorkspace[];
  categories: AzureLogAnalyticsMetadataCategory[];
}

export interface AzureLogAnalyticsMetadataCategory {
  id: string;
  displayName: string;
  related: AzureLogAnalyticsMetadataCategoryRelated;
}

export interface AzureLogAnalyticsMetadataCategoryRelated {
  tables: string[];
  functions?: string[];
}

export interface AzureLogAnalyticsMetadataFunction {
  id: string;
  name: string;
  displayName?: string;
  description: string;
  body: string;
  parameters?: string;
  related: AzureLogAnalyticsMetadataFunctionRelated;
}

export interface AzureLogAnalyticsMetadataFunctionRelated {
  solutions: string[];
  categories?: string[];
  tables: string[];
}

export interface AzureLogAnalyticsMetadataResourceType {
  id: string;
  type: string;
  displayName: string;
  description: string;
  related: AzureLogAnalyticsMetadataResourceTypeRelated;
}

export interface AzureLogAnalyticsMetadataResourceTypeRelated {
  tables: string[];
  workspaces: string[];
}

export interface AzureLogAnalyticsMetadataSolution {
  id: string;
  name: string;
  related: AzureLogAnalyticsMetadataSolutionRelated;
}

export interface AzureLogAnalyticsMetadataSolutionRelated {
  tables: string[];
  functions: string[];
  workspaces: string[];
}

export interface AzureLogAnalyticsMetadataTable {
  id: string;
  name: string;
  description?: string;
  timespanColumn: string;
  columns: AzureLogAnalyticsMetadataColumn[];
  related: AzureLogAnalyticsMetadataTableRelated;
  isTroubleshootingAllowed?: boolean;
  hasData?: boolean;
}

export interface AzureLogAnalyticsMetadataColumn {
  name: string;
  type: string;
  description?: string;
  isPreferredFacet?: boolean;
}

export interface AzureLogAnalyticsMetadataTableRelated {
  categories?: string[];
  solutions: string[];
  functions?: string[];
}

export interface AzureLogAnalyticsMetadataWorkspace {
  id: string;
  resourceId: string;
  name: string;
  region: string;
  related: AzureLogAnalyticsMetadataWorkspaceRelated;
}

export interface AzureLogAnalyticsMetadataWorkspaceRelated {
  solutions: string[];
}
