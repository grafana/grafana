import { Resizable, ResizeCallback } from 're-resizable';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';

import { DataFrame, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { getDragStyles, IconButton, useStyles2 } from '@grafana/ui';

import { useLogListContext } from '../panel/LogListContext';
import { reportInteractionOnce } from '../panel/analytics';
import { LogListModel } from '../panel/processing';

import { FieldSelector, FIELD_SELECTOR_MIN_WIDTH, getDefaultFieldSelectorWidth } from './FieldSelector';
import { getFieldSelectorWidth } from './fieldSelectorUtils';
import { getFieldsWithStats } from './getFieldsWithStats';
import { logsFieldSelectorWrapperStyles } from './styles';
import { getSuggestedFieldsFromLogList } from './suggestedFields';

/**
 * FieldSelector wrapper for the LogList visualization.
 */
interface LogListFieldSelectorProps {
  containerElement: HTMLDivElement;
  logs: LogListModel[];
  dataFrames: DataFrame[];
}

export const LogListFieldSelector = ({ containerElement, dataFrames, logs }: LogListFieldSelectorProps) => {
  const { displayedFields, onClickShowField, onClickHideField, setDisplayedFields, logOptionsStorageKey } =
    useLogListContext();
  const [sidebarHeight, setSidebarHeight] = useState(220);
  const [sidebarWidth, setSidebarWidth] = useState(getFieldSelectorWidth(logOptionsStorageKey));
  const dragStyles = useStyles2(getDragStyles);

  useLayoutEffect(() => {
    const observer = new ResizeObserver((entries: ResizeObserverEntry[]) => {
      if (entries.length) {
        setSidebarHeight(entries[0].contentRect.height);
      }
    });
    observer.observe(containerElement);
    return () => observer.disconnect();
  }, [containerElement]);

  const setSidebarWidthWrapper = useCallback(
    (width: number) => {
      setSidebarWidth(width);
      if (logOptionsStorageKey) {
        store.set(`${logOptionsStorageKey}.fieldSelector.width`, width);
      }
    },
    [logOptionsStorageKey]
  );

  const clearFields = useCallback(() => {
    setDisplayedFields?.([]);
    reportInteraction('logs_field_selector_clear_fields_clicked', {
      fields: displayedFields.length,
      mode: 'logs',
    });
  }, [displayedFields.length, setDisplayedFields]);

  const collapse = useCallback(() => {
    setSidebarWidthWrapper(FIELD_SELECTOR_MIN_WIDTH);
    reportInteraction('logs_field_selector_collapse_clicked', {
      mode: 'logs',
    });
  }, [setSidebarWidthWrapper]);

  const expand = useCallback(() => {
    const width = getFieldSelectorWidth(logOptionsStorageKey);
    setSidebarWidthWrapper(width < 2 * FIELD_SELECTOR_MIN_WIDTH ? getDefaultFieldSelectorWidth() : width);
    reportInteraction('logs_field_selector_expand_clicked', {
      mode: 'logs',
    });
  }, [logOptionsStorageKey, setSidebarWidthWrapper]);

  const handleResize: ResizeCallback = useCallback(
    (event, direction, ref) => {
      setSidebarWidthWrapper(ref.clientWidth);
      reportInteractionOnce('logs_field_selector_resized', {
        mode: 'logs',
      });
    },
    [setSidebarWidthWrapper]
  );

  const toggleField = useCallback(
    (name: string) => {
      if (displayedFields.includes(name)) {
        onClickHideField?.(name);
      } else {
        onClickShowField?.(name);
      }
    },
    [displayedFields, onClickHideField, onClickShowField]
  );

  const suggestedFields = useMemo(() => getSuggestedFieldsFromLogList(logs, displayedFields), [displayedFields, logs]);
  const fields = useMemo(() => getFieldsWithStats(dataFrames), [dataFrames]);

  if (!onClickShowField || !onClickHideField || !setDisplayedFields) {
    console.warn(
      'LogListFieldSelector: Missing required props: onClickShowField, onClickHideField, setDisplayedFields'
    );
    return null;
  }
  if (sidebarHeight === 0) {
    return null;
  }

  return (
    <Resizable
      enable={{
        right: true,
      }}
      handleClasses={{ right: dragStyles.dragHandleVertical }}
      size={{ width: sidebarWidth, height: sidebarHeight }}
      defaultSize={{ width: sidebarWidth, height: sidebarHeight }}
      minWidth={FIELD_SELECTOR_MIN_WIDTH}
      maxWidth={containerElement.clientWidth * 0.8}
      onResize={handleResize}
    >
      {sidebarWidth > FIELD_SELECTOR_MIN_WIDTH * 2 ? (
        <FieldSelector
          activeFields={displayedFields}
          clear={clearFields}
          collapse={collapse}
          fields={fields}
          reorder={setDisplayedFields}
          suggestedFields={suggestedFields}
          toggle={toggleField}
        />
      ) : (
        <div className={logsFieldSelectorWrapperStyles.collapsedButtonContainer}>
          <IconButton
            className={logsFieldSelectorWrapperStyles.collapsedButton}
            onClick={expand}
            name="arrow-from-right"
            tooltip={t('logs.field-selector.expand', 'Expand sidebar')}
            size="sm"
          />
        </div>
      )}
    </Resizable>
  );
};
