import { css } from '@emotion/css';
import * as React from 'react';

import { type GrafanaTheme2, type TraceKeyValuePair } from '@grafana/data';
import { Counter, Icon, useStyles2 } from '@grafana/ui';

import type TNil from '../../types/TNil';

import { KeyValuesSummary } from './KeyValuesSummary';
import KeyValuesTable, { type KeyValuesTableLink } from './KeyValuesTable';
import {
  type AttributeSectionType,
  groupAttributesByCategory,
  OTHER_CATEGORY_ID,
  SERVICE_HEXAGON_CATEGORY_ICON,
} from './attributeCategories';
import { ServiceHexagonIcon } from './icons/ServiceHexagonIcon';

export type AccordionCategorizedKeyValuesProps = {
  data: TraceKeyValuePair[];
  sectionType: AttributeSectionType;
  isOpen: boolean;
  label: string;
  linksGetter?: ((pairs: TraceKeyValuePair[], index: number) => KeyValuesTableLink[]) | TNil;
  onToggle?: null | (() => void);
};

export default function AccordionCategorizedKeyValues({
  data,
  sectionType,
  isOpen,
  label,
  linksGetter,
  onToggle = null,
}: AccordionCategorizedKeyValuesProps) {
  const styles = useStyles2(getStyles);
  const isEmpty = !Array.isArray(data) || !data.length;
  const groupedCategories = React.useMemo(() => groupAttributesByCategory(data, sectionType), [data, sectionType]);
  const showFlatAttributes = groupedCategories.length === 1 && groupedCategories[0].category.id === OTHER_CATEGORY_ID;
  const [closedCategories, setClosedCategories] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    setClosedCategories(new Set());
  }, [data, sectionType]);

  const toggleCategory = React.useCallback((categoryId: string) => {
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

  const arrow = isOpen ? (
    <Icon name="angle-down" className={styles.chevronIcon} />
  ) : (
    <Icon name="angle-right" className={styles.chevronIcon} />
  );

  const headerProps =
    isEmpty || !onToggle
      ? {}
      : {
          'aria-checked': isOpen,
          onClick: onToggle,
          role: 'switch' as const,
        };

  const showDataSummaryFields = data.length > 0 && !isOpen;

  return (
    <div className={styles.container}>
      <div className={styles.header} {...headerProps} data-testid="AccordionCategorizedKeyValues--header">
        {arrow}
        <strong className={styles.headerLabel}>{label}</strong>
        {showDataSummaryFields && (
          <span className={styles.summary}>
            <KeyValuesSummary data={data} />
          </span>
        )}
      </div>
      {isOpen &&
        (showFlatAttributes ? (
          <KeyValuesTable data={data} linksGetter={linksGetter} />
        ) : (
          <div className={styles.categories} data-testid="AccordionCategorizedKeyValues--categories">
            {groupedCategories.map(({ category, attributes }) => {
              const isCategoryOpen = !closedCategories.has(category.id);

              return (
                <div className={styles.category} key={category.id} data-testid={`attribute-category-${category.id}`}>
                  <button
                    type="button"
                    className={styles.categoryHeader}
                    aria-expanded={isCategoryOpen}
                    onClick={() => toggleCategory(category.id)}
                  >
                    <Icon name={isCategoryOpen ? 'angle-down' : 'angle-right'} className={styles.chevronIcon} />
                    <span className={styles.categoryHeaderContent}>
                      {category.icon === SERVICE_HEXAGON_CATEGORY_ICON ? (
                        <ServiceHexagonIcon className={styles.categoryIcon} />
                      ) : (
                        <Icon name={category.icon} className={styles.categoryIcon} />
                      )}
                      <span className={styles.categoryLabel}>{category.label}</span>
                      <span className={styles.categoryCounter}>
                        <Counter value={attributes.length} variant="secondary" />
                      </span>
                    </span>
                  </button>
                  {isCategoryOpen && (
                    <div className={styles.categoryContent}>
                      <KeyValuesTable data={attributes} linksGetter={linksGetter} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const sectionPaddingX = theme.spacing(0.5);
  const categoryIndent = theme.spacing(0.5);
  const iconGap = theme.spacing(0.5);
  const categoryIconSize = theme.spacing(2);

  return {
    container: css({
      textOverflow: 'ellipsis',
      padding: `0 ${sectionPaddingX}`,
      background: theme.colors.background.primary,
      borderRadius: theme.shape.radius.default,
    }),
    header: css({
      label: 'header',
      display: 'flex',
      alignItems: 'center',
      gap: iconGap,
      cursor: 'pointer',
      overflow: 'hidden',
      padding: `${theme.spacing(0.5)} 0`,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    headerLabel: css({
      width: 'auto',
      display: 'inline-block',
    }),
    summary: css({
      marginLeft: '0.7em',
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
      fontSize: theme.typography.bodySmall.fontSize,
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
    }),
    categoryHeaderContent: css({
      label: 'categoryHeaderContent',
      display: 'flex',
      alignItems: 'center',
      gap: iconGap,
      minWidth: 0,
    }),
    categoryContent: css({
      padding: 0,
    }),
    chevronIcon: css({
      label: 'chevronIcon',
      display: 'inline-flex',
      alignItems: 'center',
      flexShrink: 0,
    }),
    categoryIcon: css({
      label: 'categoryIcon',
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
      label: 'categoryLabel',
      lineHeight: 1,
      flexShrink: 0,
    }),
    categoryCounter: css({
      label: 'categoryCounter',
      display: 'inline-flex',
      alignItems: 'center',
      flexShrink: 0,
      '& > span': {
        marginLeft: 0,
      },
    }),
  };
};
