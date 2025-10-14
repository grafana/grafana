import { css } from '@emotion/css';
import { Resizable, ResizeCallback } from 're-resizable';
import { startTransition, useCallback, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { getDragStyles, useStyles2 } from '@grafana/ui';

import { useLogListContext } from '../LogListContext';
import { LogListModel } from '../processing';

import { FieldSearch } from './FieldSearch';
import { LogsTableMultiSelect } from './LogsTableMultiSelect';

interface LogListFieldSelectorProps {
  containerElement: HTMLDivElement;
  logs: LogListModel[];
}

/**
 * FieldSelector wrapper for the LogList visualization.
 */
export const LogListFieldSelector = ({ containerElement, logs }: LogListFieldSelectorProps) => {
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const { onClickShowField, onClickHideField, setDisplayedFields } = useLogListContext();

  const dragStyles = useStyles2(getDragStyles);

  const getOnResize: ResizeCallback = useCallback((event, direction, ref) => {
    const newSidebarWidth = Number(ref.style.width.slice(0, -2));
    if (!isNaN(newSidebarWidth)) {
      setSidebarWidth(newSidebarWidth);
    }
  }, []);

  if (!onClickShowField || !onClickHideField || !setDisplayedFields) {
    console.warn('Missing required props: onClickShowField, onClickHideField, setDisplayedFields');
    return null;
  }

  return (
    <Resizable
      enable={{
        right: true,
      }}
      handleClasses={{ right: dragStyles.dragHandleVertical }}
      defaultSize={{ width: sidebarWidth, height: containerElement.clientHeight }}
      onResize={getOnResize}
    ></Resizable>
  );
};

export interface FieldSelectorProps {
  showField: (key: string) => void;
  hideField: (key: string) => void;
  setFields: (displayedFields: string[]) => void;
}

export const FieldSelector = ({ showField, hideField, setFields }: FieldSelectorProps) => {
  const [searchValue, setSearchValue] = useState<string>('');
  const styles = useStyles2(getStyles);

  const onSearchInputChange = (e: React.FormEvent<HTMLInputElement>) => {
    startTransition(() => {
      setSearchValue(e.currentTarget.value);
    });
  };

  return (
    <section className={styles.sidebar}>
      <FieldSearch value={searchValue} onChange={onSearchInputChange} />
      <LogsTableMultiSelect
        reorderColumn={() => {}}
        toggleColumn={() => {}}
        filteredColumnsWithMeta={{}}
        columnsWithMeta={{}}
        clear={() => {}}
      />
    </section>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    sidebar: css({
      fontSize: theme.typography.pxToRem(11),
      paddingRight: theme.spacing(3),
    }),
  };
}
