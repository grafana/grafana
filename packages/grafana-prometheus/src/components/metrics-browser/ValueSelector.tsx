import { ChangeEvent, MouseEvent } from 'react';
import { FixedSizeList } from 'react-window';

import { selectors } from '@grafana/e2e-selectors';
import { Input, Label, BrowserLabel as PromLabel } from '@grafana/ui';

import { SelectableLabel, LIST_ITEM_SIZE } from './types';

interface ValueSelectorProps {
  selectedLabels: SelectableLabel[];
  valueSearchTerm: string;
  onChangeValueSearch: (event: ChangeEvent<HTMLInputElement>) => void;
  onClickValue: (name: string, value: string | undefined, event: MouseEvent<HTMLElement>) => void;
  onClickLabel: (name: string, value: string | undefined, event: MouseEvent<HTMLElement>) => void;
  styles: Record<string, string>;
}

export function ValueSelector({
  selectedLabels,
  valueSearchTerm,
  onChangeValueSearch,
  onClickValue,
  onClickLabel,
  styles,
}: ValueSelectorProps) {
  return (
    <div className={styles.section}>
      <Label description="Use the search field to find values across selected labels.">
        3. Select (multiple) values for your labels
      </Label>
      <div>
        <Input
          onChange={onChangeValueSearch}
          aria-label="Filter expression for label values"
          value={valueSearchTerm}
          data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.labelValuesFilter}
        />
      </div>
      <div className={styles.valueListArea}>
        {selectedLabels.map((label) => (
          <div role="list" key={label.name} aria-label={`Values for ${label.name}`} className={styles.valueListWrapper}>
            <div className={styles.valueTitle}>
              <PromLabel
                name={label.name}
                loading={label.loading}
                active={label.selected}
                hidden={label.hidden}
                // If no facets, we want to show number of all label values
                facets={label.facets || label.values?.length}
                onClick={onClickLabel}
              />
            </div>
            <FixedSizeList
              height={Math.min(200, LIST_ITEM_SIZE * (label.values?.length || 0))}
              itemCount={label.values?.length || 0}
              itemSize={28}
              itemKey={(i) => label.values![i].name}
              width={200}
              className={styles.valueList}
            >
              {({ index, style }) => {
                const value = label.values?.[index];
                if (!value) {
                  return null;
                }
                return (
                  <div style={style}>
                    <PromLabel
                      name={label.name}
                      value={value?.name}
                      active={value?.selected}
                      onClick={onClickValue}
                      searchTerm={valueSearchTerm}
                    />
                  </div>
                );
              }}
            </FixedSizeList>
          </div>
        ))}
      </div>
    </div>
  );
}
