import { QueryTemplatesList } from './QueryTemplatesList';

export interface QueryLibraryProps {
  // List of active datasources to filter the query library by
  // E.g in Explore the active datasources are the datasources that are currently selected in the query editor
  activeDatasources?: string[];
}

export function QueryLibrary({ activeDatasources }: QueryLibraryProps) {
  return <QueryTemplatesList activeDatasources={activeDatasources} />;
}
