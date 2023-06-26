import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';

import { GrafanaTheme2, PanelPluginMeta } from '@grafana/data';
import { CustomScrollbar, Icon, Input, Modal, useStyles2 } from '@grafana/ui';

import { VizTypePickerPlugin } from '../../../panel/components/VizTypePicker/VizTypePickerPlugin';
import { filterWidgetList, getWidgetPluginMeta } from '../../../panel/state/util';

interface Props {
  onDismiss: () => void;
}
export const AddWidgetModal = ({ onDismiss }: Props) => {
  const styles = useStyles2(getStyles);
  const [searchQuery, setSearchQuery] = useState('');

  const widgetsList: PanelPluginMeta[] = useMemo(() => {
    return getWidgetPluginMeta();
  }, []);

  const filteredWidgetsTypes = useMemo((): PanelPluginMeta[] => {
    return filterWidgetList(widgetsList, searchQuery);
  }, [widgetsList, searchQuery]);

  return (
    <Modal
      title="Select widget type"
      closeOnEscape={true}
      closeOnBackdropClick={true}
      isOpen={true}
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
              onClick={(e) => {}}
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
    grid-gap: ${theme.spacing(0.5)};
  `,
});
