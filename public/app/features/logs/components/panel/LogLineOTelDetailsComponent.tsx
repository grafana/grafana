import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { DataFrameType, type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Box, Counter, Icon, useStyles2 } from '@grafana/ui';

import { type FieldDef } from '../logParser';
import { ServiceHexagonIcon } from '../otel/ServiceHexagonIcon';
import {
  groupOTelAttributes,
  OTHER_CATEGORY_ID,
  SERVICE_HEXAGON_CATEGORY_ICON,
  type GroupedOTelAttributes,
} from '../otel/details';
import { useAttributesExtensionLinks } from '../useAttributesExtensionLinks';

import { type LabelWithLinks, LogLineDetailsFields, LogLineDetailsLabelFields } from './LogLineDetailsFields';
import { type LogListModel } from './processing';
import { useLogListContext } from './LogListContext';
import { LogListFontSize } from './LogList';

interface LogLineDetailsOTelComponentProps {
  log: LogListModel;
  logs: LogListModel[];
  prettifyDetailsJSON: boolean;
  search?: string;
  setPrettifyDetailsJSON: (prettifyDetailsJSON: boolean) => void;
  timeRange: TimeRange;
  timeZone: string;
}

type GroupedOTelDetails =
  | { kind: 'fields'; groups: Array<GroupedOTelAttributes<FieldDef>> }
  | { kind: 'labels'; groups: Array<GroupedOTelAttributes<LabelWithLinks>> };

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

  // Datasources expose attributes as either dataframe fields or labels, not both.
  const groupedAttributes = useMemo<GroupedOTelDetails>(
    () =>
      fieldsWithoutLinks.length > 0
        ? { kind: 'fields', groups: groupOTelAttributes(fieldsWithoutLinks, (field) => field.keys[0] ?? '') }
        : { kind: 'labels', groups: groupOTelAttributes(labelsWithLinks, (label) => label.key) },
    [fieldsWithoutLinks, labelsWithLinks]
  );

  return (
    <LogLineDetailsOTelComponentBody groupedAttributes={groupedAttributes} log={log} logs={logs} search={search} />
  );
};

interface LogLineDetailsOTelComponentBodyProps {
  groupedAttributes: GroupedOTelDetails;
  log: LogListModel;
  logs: LogListModel[];
  search: string;
}

const LogLineDetailsOTelComponentBody = ({
  groupedAttributes,
  log,
  logs,
  search,
}: LogLineDetailsOTelComponentBodyProps) => {
  const { fontSize } = useLogListContext();
  const styles = useStyles2(getStyles, fontSize);
  const [closedCategories, setClosedCategories] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setClosedCategories(new Set());
  }, [groupedAttributes]);

  const toggleCategory = useCallback((categoryId: string) => {
    setClosedCategories((previousClosedCategories) => {
      const nextClosedCategories = new Set(previousClosedCategories);

      if (nextClosedCategories.has(categoryId)) {
        nextClosedCategories.delete(categoryId);
      } else {
        nextClosedCategories.add(categoryId);
      }

      return nextClosedCategories;
    });
  }, []);

  if (!groupedAttributes.groups.length) {
    return (
      <div className={styles.componentWrapper}>
        <Box marginTop={1} paddingLeft={0.5}>
          <Trans i18nKey="logs.log-line-details.no-details">No fields to display.</Trans>
        </Box>
      </div>
    );
  }

  const showFlatAttributes =
    groupedAttributes.groups.length === 1 && groupedAttributes.groups[0].category.id === OTHER_CATEGORY_ID;

  return (
    <div className={styles.componentWrapper}>
      <div className={styles.container}>
        {showFlatAttributes ? (
          <OTelAttributeItems groupedAttributes={groupedAttributes} log={log} logs={logs} search={search} />
        ) : (
          <div className={styles.categories}>
            {groupedAttributes.groups.map(({ category, items }) => {
              const isCategoryOpen = !closedCategories.has(category.id);
              const label = t(category.labelKey, category.defaultLabel);

              return (
                <div className={styles.category} key={category.id}>
                  <button
                    type="button"
                    className={styles.categoryHeader}
                    aria-expanded={isCategoryOpen}
                    onClick={() => toggleCategory(category.id)}
                  >
                    <Icon name={isCategoryOpen ? 'angle-down' : 'angle-right'} className={styles.chevronIcon} size={fontSize === 'small' ? 'md' : 'lg'} />
                    <span className={styles.categoryHeaderContent}>
                      {category.icon === SERVICE_HEXAGON_CATEGORY_ICON ? (
                        <ServiceHexagonIcon className={styles.categoryIcon} />
                      ) : (
                        <Icon name={category.icon} className={styles.categoryIcon} />
                      )}
                      <span className={styles.categoryLabel}>{label}</span>
                      <span className={styles.categoryCounter}>
                        <Counter value={items.length} variant="secondary" />
                      </span>
                    </span>
                  </button>
                  {isCategoryOpen && (
                    <div className={styles.categoryContent}>
                      <OTelAttributeItems
                        groupedAttributes={
                          groupedAttributes.kind === 'fields'
                            ? { kind: 'fields', groups: [{ category, items }] }
                            : { kind: 'labels', groups: [{ category, items }] }
                        }
                        log={log}
                        logs={logs}
                        search={search}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

function OTelAttributeItems({
  groupedAttributes,
  log,
  logs,
  search,
}: {
  groupedAttributes: GroupedOTelDetails;
  log: LogListModel;
  logs: LogListModel[];
  search: string;
}) {
  if (groupedAttributes.kind === 'fields') {
    return (
      <LogLineDetailsFields
        log={log}
        logs={logs}
        fields={groupedAttributes.groups.flatMap((group) => group.items)}
        search={search}
      />
    );
  }

  return (
    <LogLineDetailsLabelFields
      log={log}
      logs={logs}
      fields={groupedAttributes.groups.flatMap((group) => group.items)}
      search={search}
    />
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
