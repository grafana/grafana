import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { getLogsFieldsStyles } from './ActiveFields';
import { EmptyFields } from './EmptyFields';
import { Field } from './Field';
import { FieldWithStats } from './FieldSelector';

interface Props {
  activeFields: string[];
  fields: FieldWithStats[];
  toggle: (key: string) => void;
  reorder: (columns: string[]) => void;
}

export const AvailableFields = ({ activeFields, fields, toggle, reorder }: Props): JSX.Element => {
  const styles = useStyles2(getLogsFieldsStyles);

  const availableFields = useMemo(() => fields.filter(field => !activeFields.includes(field.name)), [activeFields, fields]);
  
  if (availableFields.length) {
    return (
      <div className={styles.columnWrapper}>
        {availableFields.map((field) => (
          <div
            key={field.name}
            className={styles.wrap}
            title={t(
              'logs.field-selector.label-title',
              `{{fieldName}} appears in {{percentage}}% of log lines`,
              { fieldName: field.name, percentage: field.stats.percentOfLinesWithLabel }
            )}
          >
            <Field field={field} toggle={toggle} showCount />
          </div>
        ))}
      </div>
    );
  }

  return <EmptyFields />;
};
