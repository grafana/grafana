import { type TablePlan } from './types';

export interface AzureLogAnalyticsMetadata {
  functions: AzureLogAnalyticsMetadataFunction[];
  resourceTypes: AzureLogAnalyticsMetadataResourceType[];
  tables: AzureLogAnalyticsMetadataTable[];
  solutions: AzureLogAnalyticsMetadataSolution[];
  workspaces: AzureLogAnalyticsMetadataWorkspace[];
  categories: AzureLogAnalyticsMetadataCategory[];
}

interface AzureLogAnalyticsMetadataCategory {
  id: string;
  displayName: string;
  related: AzureLogAnalyticsMetadataCategoryRelated;
}

interface AzureLogAnalyticsMetadataCategoryRelated {
  tables: string[];
  functions?: string[];
}

interface AzureLogAnalyticsMetadataFunction {
  id: string;
  name: string;
  displayName?: string;
  description: string;
  body: string;
  parameters?: string;
  related: AzureLogAnalyticsMetadataFunctionRelated;
}

interface AzureLogAnalyticsMetadataFunctionRelated {
  solutions: string[];
  categories?: string[];
  tables: string[];
}

interface AzureLogAnalyticsMetadataResourceType {
  id: string;
  type: string;
  displayName: string;
  description: string;
  related: AzureLogAnalyticsMetadataResourceTypeRelated;
}

interface AzureLogAnalyticsMetadataResourceTypeRelated {
  tables: string[];
  workspaces: string[];
}

interface AzureLogAnalyticsMetadataSolution {
  id: string;
  name: string;
  related: AzureLogAnalyticsMetadataSolutionRelated;
}

interface AzureLogAnalyticsMetadataSolutionRelated {
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
  // TablePlan does not come directly from the API - we determine it
  plan?: TablePlan;
}

export interface AzureLogAnalyticsMetadataColumn {
  name: string;
  type: string;
  description?: string;
  isPreferredFacet?: boolean;
}

interface AzureLogAnalyticsMetadataTableRelated {
  categories?: string[];
  solutions: string[];
  functions?: string[];
}

interface AzureLogAnalyticsMetadataWorkspace {
  id: string;
  resourceId: string;
  name: string;
  region: string;
  related: AzureLogAnalyticsMetadataWorkspaceRelated;
}

interface AzureLogAnalyticsMetadataWorkspaceRelated {
  solutions: string[];
}
