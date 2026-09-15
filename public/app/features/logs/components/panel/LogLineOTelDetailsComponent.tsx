import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { DataFrameType, store, type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Box, Counter, Icon, useStyles2 } from '@grafana/ui';

import { type FieldDef } from '../logParser';
import { ServiceHexagonIcon } from '../otel/ServiceHexagonIcon';
import {
  groupOTelAttributes,
  type OTelAttributeCategory,
  SERVICE_HEXAGON_CATEGORY_ICON,
  type GroupedOTelAttributes,
} from '../otel/details';
import { useAttributesExtensionLinks } from '../useAttributesExtensionLinks';

import { filterFields, filterLabels, type LabelWithLinks } from './LogLineDetailsFields';
import { LogLineOTelDetailsError } from './LogLineOTelDetailsError';
import { LogLineOTelDetailsFields, LogLineOTelDetailsLabelFields } from './LogLineOTelDetailsFields';
import { type LogListFontSize } from './LogList';
import { useLogListContext } from './LogListContext';
import { type LogListModel } from './processing';

interface LogLineDetailsOTelComponentProps {
  log: LogListModel;
  logs: LogListModel[];
  prettifyDetailsJSON: boolean;
  search?: string;
  setPrettifyDetailsJSON: (prettifyDetailsJSON: boolean) => void;
  timeRange: TimeRange;
  timeZone: string;
}

export const LogLineDetailsOTelComponent = ({
  log,
  logs,
  search = '',
  timeRange,
}: LogLineDetailsOTelComponentProps) => {
  const extensionLinks = useAttributesExtensionLinks(log, timeRange);

  const fieldsWithoutLinks = useMemo(
    () =>
      log.dataFrame.meta?.type === DataFrameType.LogLines
        ? // for LogLines frames (dataplane) we don't want to show any additional fields besides already extracted labels and links
        []
        : // for other frames, do not show the log message unless there is a link attached
        log.fields.filter((f) => f.links?.length === 0 && f.fieldIndex !== log.entryFieldIndex).sort(),
    [log.dataFrame.meta?.type, log.entryFieldIndex, log.fields]
  );

  const labelsWithLinks: LabelWithLinks[] = useMemo(
    () =>
      Object.keys(log.labels)
        .sort()
        .map((label) => ({
          key: label,
          value: log.labels[label],
          links: extensionLinks?.[label],
        })),
    [extensionLinks, log.labels]
  );

  const groupedFields = useMemo(
    () => groupOTelAttributes(fieldsWithoutLinks, (field) => field.keys[0] ?? ''),
    [fieldsWithoutLinks]
  );
  const groupedLabels = useMemo(() => groupOTelAttributes(labelsWithLinks, (label) => label.key), [labelsWithLinks]);

  return (
    <LogLineDetailsOTelComponentBody
      fields={fieldsWithoutLinks}
      groupedFields={groupedFields}
      groupedLabels={groupedLabels}
      labels={labelsWithLinks}
      log={log}
      logs={logs}
      search={search}
    />
  );
};

interface LogLineDetailsOTelComponentBodyProps {
  fields: FieldDef[];
  groupedFields: Array<GroupedOTelAttributes<FieldDef>>;
  groupedLabels: Array<GroupedOTelAttributes<LabelWithLinks>>;
  labels: LabelWithLinks[];
  log: LogListModel;
  logs: LogListModel[];
  search: string;
}

const LogLineDetailsOTelComponentBody = ({
  fields,
  groupedFields,
  groupedLabels,
  labels,
  log,
  logs,
  search,
}: LogLineDetailsOTelComponentBodyProps) => {
  const { fontSize } = useLogListContext();
  const styles = useStyles2(getStyles, fontSize);

  if (!groupedFields.length && !groupedLabels.length) {
    return (
      <div className={styles.componentWrapper}>
        <Box marginTop={1} paddingLeft={0.5}>
          <Trans i18nKey="logs.log-line-details.no-details">No fields to display.</Trans>
        </Box>
      </div>
    );
  }

  return (
    <div className={styles.componentWrapper}>
      <div className={styles.container}>
        <LogLineOTelDetailsError fields={fields} labels={labels} />
        <div className={styles.categories}>
          {groupedFields.length > 0 &&
            groupedFields.map(({ category, items }) => (
              <OTelCategory<FieldDef>
                key={category.id}
                category={category}
                items={items}
                filter={filterFields}
                log={log}
                logs={logs}
                search={search}
                RenderFields={LogLineOTelDetailsFields}
              />
            ))}
          {groupedLabels.length > 0 &&
            groupedLabels.map(({ category, items }) => (
              <OTelCategory<LabelWithLinks>
                key={category.id}
                category={category}
                items={items}
                filter={filterLabels}
                log={log}
                logs={logs}
                search={search}
                RenderFields={LogLineOTelDetailsLabelFields}
              />
            ))}
        </div>
      </div>
    </div>
  );
};

function OTelCategory<T>({
  category,
  filter,
  items,
  log,
  logs,
  RenderFields,
  search,
}: {
  category: OTelAttributeCategory;
  filter: (f: T[], s: string) => T[];
  items: T[];
  log: LogListModel;
  logs: LogListModel[];
  RenderFields: (props: { fields: T[]; log: LogListModel; logs: LogListModel[] }) => JSX.Element | null;
  search?: string;
}) {
  const { fontSize, logOptionsStorageKey } = useLogListContext();
  const [expanded, setExpanded] = useState(
    logOptionsStorageKey ? store.getBool(`${logOptionsStorageKey}.log-details.${category.id}-open`, true) : true
  );
  const styles = useStyles2(getStyles, fontSize);

  useEffect(() => {
    setExpanded((expanded) =>
      logOptionsStorageKey
        ? store.getBool(`${logOptionsStorageKey}.log-details.${category.id}-open`, expanded)
        : expanded
    );
  }, [category.id, logOptionsStorageKey]);

  const toggleCategory = useCallback(() => {
    if (expanded) {
      setExpanded(false);
      store.delete(`${logOptionsStorageKey}.log-details.${category.id}-open`);
    } else {
      setExpanded(true);
      store.set(`${logOptionsStorageKey}.log-details.${category.id}-open`, true);
    }
  }, [category.id, expanded, logOptionsStorageKey]);

  const label = t(category.labelKey, category.defaultLabel);
  const filteredItems = useMemo(() => search !== undefined ? filter(items, search) : items, [filter, items, search]);

  if (!items.length) {
    return null;
  }

  return (
    <div className={styles.category} key={category.id}>
      <button type="button" className={styles.categoryHeader} aria-expanded={expanded} onClick={() => toggleCategory()}>
        <Icon
          name={expanded ? 'angle-down' : 'angle-right'}
          className={styles.chevronIcon}
          size={fontSize === 'small' ? 'md' : 'lg'}
        />
        <span className={styles.categoryHeaderContent}>
          {category.icon === SERVICE_HEXAGON_CATEGORY_ICON ? (
            <ServiceHexagonIcon className={styles.categoryIcon} />
          ) : (
            <Icon name={category.icon} className={styles.categoryIcon} />
          )}
          <span className={styles.categoryLabel}>{label}</span>
          <span className={styles.categoryCounter}>
            <Counter value={filteredItems.length} variant="secondary" />
          </span>
        </span>
      </button>
      {expanded && (
        <div className={styles.categoryContent}>
          {!filteredItems.length && (
            <div className={styles.componentWrapper}>
              <Box marginTop={1} paddingLeft={0.5}>
                <Trans i18nKey="logs.log-line-details.search.no-results">No matching results.</Trans>
              </Box>
            </div>
          )}
          <RenderFields log={log} logs={logs} fields={filteredItems} />
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, fontSize: LogListFontSize) => {
  const sectionPaddingX = theme.spacing(0.5);
  const categoryIndent = theme.spacing(0.5);
  const iconGap = theme.spacing(0.5);
  const categoryIconSize = theme.spacing(2);

  return {
    componentWrapper: css({
      padding: theme.spacing(0, 1, 1, 1),
      background: theme.colors.background.primary,
    }),
    container: css({
      textOverflow: 'ellipsis',
      padding: `0 ${sectionPaddingX}`,
    }),
    categories: css({
      padding: `0 ${categoryIndent}`,
    }),
    category: css({
      marginTop: theme.spacing(1),
    }),
    categoryHeader: css({
      display: 'flex',
      alignItems: 'center',
      gap: iconGap,
      minHeight: theme.spacing(3),
      padding: `0 ${theme.spacing(0.5)}`,
      lineHeight: 1,
      fontSize: fontSize === 'small' ? theme.typography.bodySmall.fontSize : undefined,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
      cursor: 'pointer',
      appearance: 'none',
      background: 'none',
      border: 'none',
      width: '100%',
      textAlign: 'left',
      borderRadius: theme.shape.radius.default,
      '&:hover': {
        background: theme.colors.action.hover,
      },
      marginBottom: theme.spacing(1),
    }),
    categoryHeaderContent: css({
      display: 'flex',
      alignItems: 'center',
      gap: iconGap,
      minWidth: 0,
    }),
    categoryContent: css({
      padding: 0,
    }),
    chevronIcon: css({
      display: 'inline-flex',
      alignItems: 'center',
      flexShrink: 0,
    }),
    categoryIcon: css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      boxSizing: 'border-box',
      width: categoryIconSize,
      height: categoryIconSize,
      paddingRight: categoryIndent,
    }),
    categoryLabel: css({
      lineHeight: 1,
      flexShrink: 0,
    }),
    categoryCounter: css({
      display: 'inline-flex',
      alignItems: 'center',
      flexShrink: 0,
      '& > span': {
        marginLeft: 0,
      },
    }),
  };
};
