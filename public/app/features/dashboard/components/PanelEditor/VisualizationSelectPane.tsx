import React, { FC, useCallback, useEffect, useRef, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme, PanelPluginMeta, SelectableValue } from '@grafana/data';
import { Button, CustomScrollbar, Icon, Input, RadioButtonGroup, useStyles } from '@grafana/ui';
import { changePanelPlugin } from '../../state/actions';
import { PanelModel } from '../../state/PanelModel';
import { useDispatch, useSelector } from 'react-redux';
import { filterPluginList, getAllPanelPluginMeta, VizTypePicker } from '../VizTypePicker/VizTypePicker';
import { Field } from '@grafana/ui/src/components/Forms/Field';
import { PanelLibraryOptionsGroup } from 'app/features/library-panels/components/PanelLibraryOptionsGroup/PanelLibraryOptionsGroup';
import { toggleVizPicker } from './state/reducers';
import { selectors } from '@grafana/e2e-selectors';
import { getPanelPluginWithFallback } from '../../state/selectors';

interface Props {
  panel: PanelModel;
}

export const VisualizationSelectPane: FC<Props> = ({ panel }) => {
  const plugin = useSelector(getPanelPluginWithFallback(panel.type));
  const [searchQuery, setSearchQuery] = useState('');
  const [listMode, setListMode] = useState(ListMode.Visualizations);
  const dispatch = useDispatch();
  const styles = useStyles(getStyles);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const onPluginTypeChange = useCallback(
    (meta: PanelPluginMeta, withModKey: boolean) => {
      if (meta.id !== plugin.meta.id) {
        dispatch(changePanelPlugin(panel, meta.id));
      }

      // close viz picker unless a mod key is pressed while clicking
      if (!withModKey) {
        dispatch(toggleVizPicker(false));
      }
    },
    [dispatch, panel, plugin.meta.id]
  );

  // Give Search input focus when using radio button switch list mode
  useEffect(() => {
    if (searchRef.current) {
      searchRef.current.focus();
    }
  }, [listMode]);

  const onCloseVizPicker = () => {
    dispatch(toggleVizPicker(false));
  };

  const onKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const query = e.currentTarget.value;
        const plugins = getAllPanelPluginMeta();
        const match = filterPluginList(plugins, query, plugin.meta);

        if (match && match.length) {
          onPluginTypeChange(match[0], false);
        }
      }
    },
    [onPluginTypeChange, plugin.meta]
  );

  const suffix =
    searchQuery !== '' ? (
      <Button icon="times" fill="text" size="sm" onClick={() => setSearchQuery('')}>
        Clear
      </Button>
    ) : null;

  if (!plugin) {
    return null;
  }

  const radioOptions: Array<SelectableValue<ListMode>> = [
    { label: 'Visualizations', value: ListMode.Visualizations },
    {
      label: 'Library panels',
      value: ListMode.LibraryPanels,
      description: 'Reusable panels you can share between multiple dashboards.',
    },
  ];

  return (
    <div className={styles.openWrapper}>
      <div className={styles.formBox}>
        <div className={styles.searchRow}>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            onKeyPress={onKeyPress}
            prefix={<Icon name="search" />}
            suffix={suffix}
            ref={searchRef}
            placeholder="Search for..."
          />
          <Button
            title="Close"
            variant="secondary"
            icon="angle-up"
            className={styles.closeButton}
            aria-label={selectors.components.PanelEditor.toggleVizPicker}
            onClick={onCloseVizPicker}
          />
        </div>
        <Field className={styles.customFieldMargin}>
          <RadioButtonGroup options={radioOptions} value={listMode} onChange={setListMode} fullWidth />
        </Field>
      </div>
      <div className={styles.scrollWrapper}>
        <CustomScrollbar autoHeightMin="100%">
          <div className={styles.scrollContent}>
            {listMode === ListMode.Visualizations && (
              <VizTypePicker
                current={plugin.meta}
                onTypeChange={onPluginTypeChange}
                searchQuery={searchQuery}
                onClose={() => {}}
              />
            )}
            {listMode === ListMode.LibraryPanels && (
              <PanelLibraryOptionsGroup searchQuery={searchQuery} panel={panel} key="Panel Library" />
            )}
          </div>
        </CustomScrollbar>
      </div>
    </div>
  );
};

enum ListMode {
  Visualizations,
  LibraryPanels,
}

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
      flex: 1 1 100%;
      height: 100%;
      background: ${theme.colors.bg1};
      border: 1px solid ${theme.colors.border1};
    `,
    searchRow: css`
      display: flex;
      margin-bottom: ${theme.spacing.sm};
    `,
    closeButton: css`
      margin-left: ${theme.spacing.sm};
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
