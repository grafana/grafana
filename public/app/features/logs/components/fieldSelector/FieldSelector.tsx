import { css } from '@emotion/css';
import { startTransition, useCallback, useMemo, useState } from 'react';

import { fuzzySearch, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { defaultOptions } from 'app/plugins/panel/logstable/panelcfg.gen';

import { reportInteractionOnce } from '../panel/analytics';

import { FieldList } from './FieldList';
import { FieldSearch } from './FieldSearch';

const FIELD_SELECTOR_DEFAULT_WIDTH = 220;
export const FIELD_SELECTOR_MIN_WIDTH = 20;
export const getDefaultFieldSelectorWidth = () => {
  return defaultOptions.fieldSelectorWidth ?? FIELD_SELECTOR_DEFAULT_WIDTH;
};

interface FieldStats {
  percentOfLinesWithLabel: number;
}

export interface FieldWithStats {
  name: string;
  stats: FieldStats;
}

export interface FieldSelectorProps {
  activeFields: string[];
  clear(): void;
  collapse(): void;
  fields: FieldWithStats[];
  reorder(fields: string[]): void;
  suggestedFields: FieldWithStats[];
  toggle: (key: string) => void;
}

export const FieldSelector = ({
  activeFields,
  clear,
  collapse,
  fields,
  reorder,
  suggestedFields,
  toggle,
}: FieldSelectorProps) => {
  const [searchValue, setSearchValue] = useState<string>('');
  const styles = useStyles2(getStyles);

  const onSearchInputChange = useCallback((e?: React.FormEvent<HTMLInputElement>) => {
    if (e === undefined) {
      setSearchValue('');
      return;
    }
    startTransition(() => {
      setSearchValue(e.currentTarget.value);
    });
    reportInteractionOnce('logs_field_selector_text_search');
  }, []);

  const filteredFields = useMemo(() => {
    if (!searchValue) {
      return fields;
    }
    const idxs = fuzzySearch(
      fields.map((field) => field.name),
      searchValue
    );
    return fields.filter((_, index) => idxs.includes(index));
  }, [fields, searchValue]);

  const filteredSuggestedFields = useMemo(() => {
    if (!searchValue) {
      return suggestedFields;
    }
    const idxs = fuzzySearch(
      suggestedFields.map((field) => field.name),
      searchValue
    );
    return suggestedFields.filter((_, index) => idxs.includes(index));
  }, [searchValue, suggestedFields]);

  return (
    <section className={styles.sidebar}>
      <FieldSearch collapse={collapse} onChange={onSearchInputChange} value={searchValue} />
      <FieldList
        activeFields={activeFields}
        clear={clear}
        fields={filteredFields}
        reorder={reorder}
        suggestedFields={filteredSuggestedFields}
        toggle={toggle}
      />
    </section>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    sidebar: css({
      fontSize: theme.typography.pxToRem(11),
      paddingRight: theme.spacing(3),
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    }),
  };
}
