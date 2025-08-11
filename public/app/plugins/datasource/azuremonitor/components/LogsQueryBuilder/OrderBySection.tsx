import React, { useEffect, useRef, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { EditorField, EditorFieldGroup, EditorRow, InputGroup } from '@grafana/plugin-ui';
import { Button, Select, Label } from '@grafana/ui';

import {
  BuilderQueryEditorExpressionType,
  BuilderQueryEditorOrderByExpression,
  BuilderQueryEditorOrderByOptions,
  BuilderQueryEditorPropertyType,
} from '../../dataquery.gen';
import { AzureLogAnalyticsMetadataColumn } from '../../types/logAnalyticsMetadata';
import { AzureMonitorQuery } from '../../types/query';

import { BuildAndUpdateOptions, inputFieldSize } from './utils';

interface OrderBySectionProps {
  query: AzureMonitorQuery;
  allColumns: AzureLogAnalyticsMetadataColumn[];
  buildAndUpdateQuery: (options: Partial<BuildAndUpdateOptions>) => void;
}

export const OrderBySection: React.FC<OrderBySectionProps> = ({ query, allColumns, buildAndUpdateQuery }) => {
  const builderQuery = query.azureLogAnalytics?.builderQuery;
  const prevTable = useRef<string | null>(builderQuery?.from?.property.name || null);
  const hasLoadedOrderBy = useRef(false);

  const [orderBy, setOrderBy] = useState<BuilderQueryEditorOrderByExpression[]>(
    builderQuery?.orderBy?.expressions || []
  );

  useEffect(() => {
    const currentTable = builderQuery?.from?.property.name || null;

    if (prevTable.current !== currentTable || builderQuery?.orderBy?.expressions.length === 0) {
      setOrderBy([]);
      hasLoadedOrderBy.current = false;
      prevTable.current = currentTable;
    }
  }, [builderQuery]);

  const groupByColumns = builderQuery?.groupBy?.expressions?.map((g) => g.property?.name) || [];
  const aggregateColumns = builderQuery?.reduce?.expressions?.map((r) => r.property?.name) || [];
  const selectedColumns = builderQuery?.columns?.columns || [];

  const allAvailableColumns =
    groupByColumns.length > 0
      ? groupByColumns
      : aggregateColumns.length > 0
        ? aggregateColumns
        : selectedColumns.length > 0
          ? selectedColumns
          : allColumns.map((col) => col.name);

  const columnOptions = allAvailableColumns.map((col) => ({
    label: col,
    value: col,
  }));

  const orderOptions: Array<SelectableValue<string>> = [
    { label: 'Ascending', value: 'asc' },
    { label: 'Descending', value: 'desc' },
  ];

  const handleOrderByChange = (index: number, key: 'column' | 'order', value: string) => {
    setOrderBy((prev) => {
      const updated = [...prev];

      if (index === -1) {
        updated.push({
          property: { name: value, type: BuilderQueryEditorPropertyType.String },
          order: BuilderQueryEditorOrderByOptions.Asc,
          type: BuilderQueryEditorExpressionType.Order_by,
        });
      } else {
        updated[index] = {
          ...updated[index],
          property:
            key === 'column' ? { name: value, type: BuilderQueryEditorPropertyType.String } : updated[index].property,
          order:
            key === 'order' &&
            (value === BuilderQueryEditorOrderByOptions.Asc || value === BuilderQueryEditorOrderByOptions.Desc)
              ? value
              : updated[index].order,
        };
      }

      buildAndUpdateQuery({
        orderBy: updated,
      });

      return updated;
    });
  };

  const onDeleteOrderBy = (index: number) => {
    setOrderBy((prev) => {
      const updated = prev.filter((_, i) => i !== index);

      buildAndUpdateQuery({
        orderBy: updated,
      });

      return updated;
    });
  };

  return (
    <EditorRow>
      <EditorFieldGroup>
        <EditorField
          label={t('components.order-by-section.label-order-by', 'Order By')}
          optional={true}
          tooltip={t(
            'components.order-by-section.tooltip-order-by',
            'Sort results based on one or more columns in ascending or descending order.'
          )}
        >
          <>
            {orderBy.length > 0 ? (
              orderBy.map((entry, index) => (
                <InputGroup key={index}>
                  <Select
                    aria-label={t('components.order-by-section.aria-label-order-by-column', 'Order by column')}
                    width={inputFieldSize}
                    value={entry.property?.name ? { label: entry.property.name, value: entry.property.name } : null}
                    options={columnOptions}
                    onChange={(e) => e.value && handleOrderByChange(index, 'column', e.value)}
                  />
                  <Label style={{ margin: '9px 9px 0 9px' }}>
                    <Trans i18nKey="components.order-by-section.label-by">BY</Trans>
                  </Label>
                  <Select
                    aria-label={t('components.order-by-section.aria-label-order-direction', 'Order Direction')}
                    width={inputFieldSize}
                    value={orderOptions.find((o) => o.value === entry.order) || null}
                    options={orderOptions}
                    onChange={(e) => e.value && handleOrderByChange(index, 'order', e.value)}
                  />
                  <Button
                    aria-label={t('components.order-by-section.aria-label-remove-order-by', 'Remove order by')}
                    variant="secondary"
                    icon="times"
                    onClick={() => onDeleteOrderBy(index)}
                  />
                  {index === orderBy.length - 1 ? (
                    <Button
                      aria-label={t('components.order-by-section.aria-label-add-order-by', 'Add order by')}
                      variant="secondary"
                      onClick={() => handleOrderByChange(-1, 'column', '')}
                      icon="plus"
                      style={{ marginLeft: '15px' }}
                    />
                  ) : (
                    <></>
                  )}
                </InputGroup>
              ))
            ) : (
              <InputGroup>
                <Button
                  aria-label={t('components.order-by-section.aria-label-add-order-by', 'Add order by')}
                  variant="secondary"
                  onClick={() => handleOrderByChange(-1, 'column', '')}
                  icon="plus"
                />
              </InputGroup>
            )}
          </>
        </EditorField>
      </EditorFieldGroup>
    </EditorRow>
  );
};
