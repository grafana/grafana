import { Resizable, ResizeCallback } from "re-resizable";
import { useCallback, useState } from "react";

import { fuzzySearch } from "@grafana/data";
import { getDragStyles, useStyles2 } from "@grafana/ui";

import { LogsColumnSearch } from "./LogsColumnSearch";
import { LogsTableMultiSelect } from "./LogsTableMultiSelect";

export const FieldSelector = () => {
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [searchValue, setSearchValue] = useState<string>('');

  const dragStyles = useStyles2(getDragStyles);

  const getOnResize: ResizeCallback = useCallback((event, direction, ref) => {
    const newSidebarWidth = Number(ref.style.width.slice(0, -2));
    if (!isNaN(newSidebarWidth)) {
      setSidebarWidth(newSidebarWidth);
    }
  }, []);

  const search = (needle: string) => {
    fuzzySearch(Object.keys(columnsWithMeta), needle, dispatcher);
  };

  const onSearchInputChange = (e: React.FormEvent<HTMLInputElement>) => {
    const value = e.currentTarget?.value;
    setSearchValue(value);
    if (value) {
      search(value);
    } else {
      // If the search input is empty, reset the local search state.
      setFilteredColumnsWithMeta(undefined);
    }
  };

  return (
    <Resizable
      enable={{
        right: true,
      }}
      handleClasses={{ right: dragStyles.dragHandleVertical }}
      onResize={getOnResize}
    >
      <section className={styles.sidebar}>
        <LogsColumnSearch value={searchValue} onChange={onSearchInputChange} />
        <LogsTableMultiSelect
          reorderColumn={reorderColumn}
          toggleColumn={toggleColumn}
          filteredColumnsWithMeta={filteredColumnsWithMeta}
          columnsWithMeta={columnsWithMeta}
          clear={clearSelection}
        />
      </section>
    </Resizable>
  );
}
