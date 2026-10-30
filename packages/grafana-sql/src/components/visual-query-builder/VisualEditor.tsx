import { type QueryEditorProps, type QueryRowFilter } from '../../types';
import { QueryToolbox } from '../query-editor-raw/QueryToolbox';

import { SqlQueryBuilder } from './SqlQueryBuilder';

interface VisualEditorProps extends QueryEditorProps {
  queryRowFilter: QueryRowFilter;
  onValidate: (isValid: boolean) => void;
}

export function VisualEditor({ onValidate, range, ...props }: VisualEditorProps) {
  return (
    <SqlQueryBuilder {...props}>
      <QueryToolbox db={props.db} query={props.query} onValidate={onValidate} range={range} />
    </SqlQueryBuilder>
  );
}
