import React, { FC, useCallback, useState } from 'react';
import { css } from 'emotion';
import { GrafanaTheme, PanelPluginMeta, SelectableValue } from '@grafana/data';
import { Icon, Input, RadioButtonGroup, CustomScrollbar, useStyles, Button } from '@grafana/ui';
import { changePanelPlugin } from '../../state/actions';
import { StoreState } from 'app/types';
import { PanelModel } from '../../state/PanelModel';
import { useDispatch, useSelector } from 'react-redux';
import { VizTypePicker, getAllPanelPluginMeta, filterPluginList } from '../VizTypePicker/VizTypePicker';
import { Field } from '@grafana/ui/src/components/Forms/Field';
import { PanelLibraryOptionsGroup } from 'app/features/library-panels/components/PanelLibraryOptionsGroup/PanelLibraryOptionsGroup';
import { toggleVizPicker } from './state/reducers';

interface Props {
  panel: PanelModel;
}

export const VisualizationSelectPane: FC<Props> = ({ panel }) => {
  const plugin = useSelector((state: StoreState) => state.plugins.panels[panel.type]);
  const [searchQuery, setSearchQuery] = useState('');
  const [listMode, setListMode] = useState('types');
  const styles = useStyles(getStyles);

  const dispatch = useDispatch();

  const onPluginTypeChange = (meta: PanelPluginMeta) => {
    if (meta.id === plugin.meta.id) {
      dispatch(toggleVizPicker(false));
    } else {
      dispatch(changePanelPlugin(panel, meta.id));
    }
  };

  const onKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const query = e.currentTarget.value;
        const plugins = getAllPanelPluginMeta();
        const match = filterPluginList(plugins, query, plugin.meta);
        if (match && match.length) {
          onPluginTypeChange(match[0]);
        }
      }
    },
    [onPluginTypeChange]
  );

  const suffix =
    searchQuery !== '' ? (
      <Button icon="times" variant="link" size="sm" onClick={() => setSearchQuery('')}>
        Clear
      </Button>
    ) : null;

  if (!plugin) {
    return null;
  }

  const radioOptions: Array<SelectableValue<string>> = [
    { label: 'Visualizations', value: 'types' },
    { label: 'Libray', value: 'library' },
    { label: 'Explore', value: 'explore' },
  ];

  return (
    <div className={styles.openWrapper}>
      <div className={styles.formBox}>
        <Field className={styles.customFieldMargin}>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            onKeyPress={onKeyPress}
            prefix={<Icon name="search" />}
            suffix={suffix}
            autoFocus
            placeholder="Search for..."
          />
        </Field>
        <Field className={styles.customFieldMargin}>
          <RadioButtonGroup options={radioOptions} value={listMode} onChange={setListMode} fullWidth />
        </Field>
      </div>
      <div className={styles.scrollWrapper}>
        <CustomScrollbar autoHeightMin="100%">
          <div className={styles.scrollContent}>
            {listMode === 'types' && (
              <VizTypePicker
                current={plugin.meta}
                onTypeChange={onPluginTypeChange}
                searchQuery={searchQuery}
                onClose={() => {}}
              />
            )}
            {listMode === 'library' && (
              <PanelLibraryOptionsGroup searchQuery={searchQuery} panel={panel} key="Panel Library" />
            )}
          </div>
        </CustomScrollbar>
      </div>
    </div>
  );
};

VisualizationSelectPane.displayName = 'VisualizationSelectPane';

const getStyles = (theme: GrafanaTheme) => {
  return {
    icon: css`
      color: ${theme.palette.gray33};
    `,
    wrapper: css`
      display: flex;
      flex-direction: column;
      flex: 1 1 0;
      height: 100%;
    `,
    vizButton: css`
      text-align: left;
    `,
    scrollWrapper: css`
      flex-grow: 1;
      min-height: 0;
    `,
    scrollContent: css`
      padding: ${theme.spacing.sm};
    `,
    openWrapper: css`
      display: flex;
      flex-direction: column;
      flex: 1 1 0;
      height: 100%;
      background: ${theme.colors.bg1};
      border: 1px solid ${theme.colors.border1};
    `,
    customFieldMargin: css`
      margin-bottom: ${theme.spacing.sm};
    `,
    formBox: css`
      padding: ${theme.spacing.sm};
      padding-bottom: 0;
    `,
  };
};
