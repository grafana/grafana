import { useTheme2 } from '@grafana/ui';

import { t } from '../../../core/internationalization';

import { getLogsFieldsStyles } from './LogsTableActiveFields';
import { LogsTableEmptyFields } from './LogsTableEmptyFields';
import { LogsTableNavField } from './LogsTableNavField';
import { FieldNameMeta } from './LogsTableWrap';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

function sortLabels(labels: Record<string, FieldNameMeta>) {
  return (a: string, b: string) => {
    const la = labels[a];
    const lb = labels[b];

    // ...sort by type and alphabetically
    if (la != null && lb != null) {
      return (
        Number(lb.type === 'TIME_FIELD') - Number(la.type === 'TIME_FIELD') ||
        Number(lb.type === 'BODY_FIELD') - Number(la.type === 'BODY_FIELD') ||
        collator.compare(a, b)
      );
    }

    // otherwise do not sort
    return 0;
  };
}

export const LogsTableAvailableFields = (props: {
  labels: Record<string, FieldNameMeta>;
  valueFilter: (value: string) => boolean;
  toggleColumn: (columnName: string) => void;
}): JSX.Element => {
  const { labels, valueFilter, toggleColumn } = props;
  const theme = useTheme2();
  const styles = getLogsFieldsStyles(theme);
  const labelKeys = Object.keys(labels).filter((labelName) => valueFilter(labelName));
  if (labelKeys.length) {
    // Otherwise show list with a hardcoded order
    return (
      <div className={styles.columnWrapper}>
        {labelKeys.sort(sortLabels(labels)).map((labelName, index) => (
          <div
            key={labelName}
            className={styles.wrap}
            title={t(
              'explore.logs-table-available-fields.title-label-percentage',
              '{{labelName}} appears in {{percentage}}% of log lines',
              { labelName, percentage: labels[labelName]?.percentOfLinesWithLabel }
            )}
          >
            <LogsTableNavField
              showCount={true}
              label={labelName}
              onChange={() => toggleColumn(labelName)}
              labels={labels}
            />
          </div>
        ))}
      </div>
    );
  }

  return <LogsTableEmptyFields />;
};
