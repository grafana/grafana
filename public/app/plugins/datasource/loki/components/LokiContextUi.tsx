import { css } from '@emotion/css';
import memoizeOne from 'memoize-one';
import React, { useEffect, useState } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2, LogRowModel, SelectableValue } from '@grafana/data';
import { MultiSelect, Tag, Tooltip, useStyles2 } from '@grafana/ui';

import LokiLanguageProvider from '../LanguageProvider';
import { ContextFilter } from '../types';

export interface LokiContextUiProps {
  languageProvider: LokiLanguageProvider;
  row: LogRowModel;
  updateFilter: (value: ContextFilter[]) => void;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    labels: css`
      display: flex;
      gap: 2px;
    `,
    multiSelectWrapper: css`
      display: flex;
      flex-direction: column;
      flex: 1;
      margin-top: ${theme.spacing(1)};
      gap: ${theme.spacing(0.5)};
    `,
    multiSelect: css`
      & .scrollbar-view {
        overscroll-behavior: contain;
      }
    `,
  };
}

const formatOptionLabel = memoizeOne(({ label, description }: SelectableValue<string>) => (
  <Tooltip content={`${label}="${description}"`} placement="top" interactive={true}>
    <span>{label}</span>
  </Tooltip>
));

export function LokiContextUi(props: LokiContextUiProps) {
  const { row, languageProvider, updateFilter } = props;
  const styles = useStyles2(getStyles);

  const [contextFilters, setContextFilters] = useState<ContextFilter[]>([]);
  const [initialized, setInitialized] = useState(false);
  const timerHandle = React.useRef<number>();
  useEffect(() => {
    if (!initialized) {
      return;
    }
    if (timerHandle.current) {
      clearTimeout(timerHandle.current);
    }
    timerHandle.current = window.setTimeout(() => {
      updateFilter(contextFilters);
    }, 2000);

    return () => {
      clearTimeout(timerHandle.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextFilters, initialized]);

  useAsync(async () => {
    await languageProvider.start();
    const allLabels = languageProvider.getLabelKeys();
    const contextFilters: ContextFilter[] = [];

    Object.entries(row.labels).forEach(([label, value]) => {
      const filter: ContextFilter = {
        label,
        value: label, // this looks weird in the first place, but we need to set the label as value here
        enabled: allLabels.includes(label),
        fromParser: !allLabels.includes(label),
        description: value,
      };
      contextFilters.push(filter);
    });

    setContextFilters(contextFilters);
    setInitialized(true);
  });

  const realLabels = contextFilters.filter(({ fromParser }) => !fromParser);
  const realLabelsEnabled = realLabels.filter(({ enabled }) => enabled);

  const parsedLabels = contextFilters.filter(({ fromParser }) => fromParser);
  const parsedLabelsEnabled = parsedLabels.filter(({ enabled }) => enabled);

  return (
    <div className={styles.multiSelectWrapper}>
      <div>
        {' '}
        <Tooltip
          content={
            'This feature is experimental and only works on simple Log queries containing no more than 1 parser (logfmt, json).'
          }
          placement="top"
        >
          <Tag
            className={css({
              fontSize: 10,
              padding: '1px 5px',
              verticalAlign: 'text-bottom',
            })}
            name={'Beta'}
            colorIndex={1}
          />
        </Tooltip>{' '}
        Select labels to include in the context query:
      </div>
      <div>
        <MultiSelect
          className={styles.multiSelect}
          prefix="Labels"
          options={realLabels}
          value={realLabelsEnabled}
          formatOptionLabel={formatOptionLabel}
          closeMenuOnSelect={true}
          maxMenuHeight={200}
          menuShouldPortal={false}
          noOptionsMessage="No further labels available"
          onChange={(keys) => {
            return setContextFilters(
              contextFilters.map((filter) => {
                if (filter.fromParser) {
                  return filter;
                }
                filter.enabled = keys.some((key) => key.value === filter.value);
                return filter;
              })
            );
          }}
        />
      </div>
      {parsedLabels.length > 0 && (
        <div>
          <MultiSelect
            className={styles.multiSelect}
            prefix="Parsed Labels"
            options={parsedLabels}
            value={parsedLabelsEnabled}
            formatOptionLabel={formatOptionLabel}
            closeMenuOnSelect={true}
            menuShouldPortal={false}
            maxMenuHeight={200}
            noOptionsMessage="No further labels available"
            isClearable={true}
            onChange={(keys) => {
              setContextFilters(
                contextFilters.map((filter) => {
                  if (!filter.fromParser) {
                    return filter;
                  }
                  filter.enabled = keys.some((key) => key.value === filter.value);
                  return filter;
                })
              );
            }}
          />
        </div>
      )}
    </div>
  );
}
