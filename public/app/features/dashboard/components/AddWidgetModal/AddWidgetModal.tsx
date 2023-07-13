import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';

import { GrafanaTheme2, PanelPluginMeta } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { CustomScrollbar, Icon, Input, Modal, useStyles2 } from '@grafana/ui';
import { onCreateNewWidgetPanel } from 'app/features/dashboard/utils/dashboard';
import { VizTypePickerPlugin } from 'app/features/panel/components/VizTypePicker/VizTypePickerPlugin';
import { filterPluginList, getWidgetPluginMeta } from 'app/features/panel/state/util';
import { useSelector } from 'app/types';

export const AddWidgetModal = () => {
  const styles = useStyles2(getStyles);
  const [searchQuery, setSearchQuery] = useState('');
  const dashboard = useSelector((state) => state.dashboard.getModel());

  const widgetsList: PanelPluginMeta[] = useMemo(() => {
    return getWidgetPluginMeta();
  }, []);

  const filteredWidgetsTypes = useMemo((): PanelPluginMeta[] => {
    return filterPluginList(widgetsList, searchQuery);
  }, [widgetsList, searchQuery]);

  const onDismiss = () => {
    locationService.partial({ addWidget: null });
  };

  return (
    <Modal
      title="Select widget type"
      closeOnEscape
      closeOnBackdropClick
      isOpen
      className={styles.modal}
      onClickBackdrop={onDismiss}
      onDismiss={onDismiss}
    >
      <Input
        type="search"
        autoFocus
        className={styles.searchInput}
        value={searchQuery}
        prefix={<Icon name="search" />}
        placeholder="Search widget"
        onChange={(e) => {
          setSearchQuery(e.currentTarget.value);
        }}
      />
      <CustomScrollbar>
        <div className={styles.grid}>
          {filteredWidgetsTypes.map((plugin, index) => (
            <VizTypePickerPlugin
              disabled={false}
              key={plugin.id}
              isCurrent={false}
              plugin={plugin}
              onClick={(e) => {
                const id = onCreateNewWidgetPanel(dashboard!, plugin.id);
                locationService.partial({ editPanel: id, addWidget: null });
              }}
            />
          ))}
        </div>
      </CustomScrollbar>
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css`
    width: 65%;
    max-width: 960px;

    ${theme.breakpoints.down('md')} {
      width: 100%;
    }
  `,
  searchInput: css`
    margin-bottom: ${theme.spacing(2)};
  `,
  grid: css`
    display: grid;
    grid-gap: ${theme.spacing(1)};
  `,
});
