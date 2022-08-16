export interface QueryBuilderOptions {
  builder: any;
  settings: any;
}

export interface QueryBuilderProps {
  options: QueryBuilderOptions;
  onOptionsChange: (options: QueryBuilderOptions) => void;
}
