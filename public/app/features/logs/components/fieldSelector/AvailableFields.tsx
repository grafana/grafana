import { css } from '@emotion/css';
import { useMemo, type JSX } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Counter, Icon, useStyles2 } from '@grafana/ui';

import { ServiceHexagonIcon } from '../otel/ServiceHexagonIcon';
import { groupOTelAttributes, SERVICE_HEXAGON_CATEGORY_ICON, type OTelAttributeCategory } from '../otel/details';

import { getLogsFieldsStyles } from './ActiveFields';
import { EmptyFields } from './EmptyFields';
import { Field } from './Field';
import { type FieldWithStats } from './FieldSelector';

interface Props {
  activeFields: string[];
  fields: FieldWithStats[];
  otelLanguages?: string[];
  toggle: (key: string) => void;
  reorder: (columns: string[]) => void;
}

export const AvailableFields = ({ activeFields, fields, otelLanguages, toggle }: Props): JSX.Element => {
  const styles = useStyles2(getLogsFieldsStyles);

  const availableFields = useMemo(
    () => fields.filter((field) => !activeFields.includes(field.name)).sort(sortFields),
    [activeFields, fields]
  );

  if (!availableFields.length) {
    return <EmptyFields />;
  }

  if (otelLanguages?.length) {
    return <CategorizedFields fields={availableFields} toggle={toggle} />;
  }

  return (
    <div className={styles.columnWrapper}>
      {availableFields.map((field) => (
        <FieldRow key={field.name} field={field} toggle={toggle} />
      ))}
    </div>
  );
};

function CategorizedFields({ fields, toggle }: { fields: FieldWithStats[]; toggle: (key: string) => void }) {
  const styles = useStyles2(getLogsFieldsStyles);
  const groupedFields = useMemo(() => groupOTelAttributes(fields, (field) => field.name), [fields]);

  return (
    <div>
      {groupedFields.map(({ category, items }) => (
        <div key={category.id}>
          <CategoryHeader category={category} count={items.length} />
          <div className={styles.columnWrapper}>
            {items.map((field) => (
              <FieldRow key={field.name} field={field} toggle={toggle} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CategoryHeader({ category, count }: { category: OTelAttributeCategory; count: number }) {
  const styles = useStyles2(getCategoryStyles);
  const label = t(category.labelKey, category.defaultLabel);

  return (
    <div className={styles.header}>
      {category.icon === SERVICE_HEXAGON_CATEGORY_ICON ? (
        <ServiceHexagonIcon className={styles.icon} />
      ) : (
        <Icon name={category.icon} className={styles.icon} />
      )}
      <span>{label}</span>
      <Counter value={count} variant="secondary" />
    </div>
  );
}

function FieldRow({ field, toggle }: { field: FieldWithStats; toggle: (key: string) => void }) {
  const styles = useStyles2(getLogsFieldsStyles);

  return (
    <div
      className={styles.wrap}
      title={t('logs.field-selector.label-title', `{{fieldName}} appears in {{percentage}}% of log lines`, {
        fieldName: field.name,
        percentage: field.stats.percentOfLinesWithLabel,
      })}
    >
      <Field field={field} toggle={toggle} showCount />
    </div>
  );
}

function getCategoryStyles(theme: GrafanaTheme2) {
  return {
    header: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      fontSize: theme.typography.h6.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      padding: theme.spacing(0.75, 0.75, 0.25, 1.5),
      color: theme.colors.text.primary,
    }),
    icon: css({
      display: 'inline-flex',
      flexShrink: 0,
    }),
  };
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

function sortFields(a: FieldWithStats, b: FieldWithStats) {
  return collator.compare(a.name, b.name);
}
