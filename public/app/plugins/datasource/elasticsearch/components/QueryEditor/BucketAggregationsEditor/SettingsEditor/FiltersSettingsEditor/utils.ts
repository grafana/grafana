import { Filter } from 'app/plugins/datasource/elasticsearch/dataquery.gen';

export const defaultFilter = (): Filter => ({ label: '', query: '*' });
