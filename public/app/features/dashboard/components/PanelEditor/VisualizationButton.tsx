import React, { FC, useCallback, useState } from 'react';
import { css } from 'emotion';
import { GrafanaTheme, PanelPlugin, PanelPluginMeta, SelectableValue } from '@grafana/data';
import {
  Icon,
  Input,
  ToolbarButton,
  ButtonGroup,
  Button,
  RadioButtonGroup,
  useStyles,
  CustomScrollbar,
} from '@grafana/ui';
import { changePanelPlugin } from '../../state/actions';
import { StoreState } from 'app/types';
import { PanelModel } from '../../state/PanelModel';
import { connect, MapStateToProps, MapDispatchToProps } from 'react-redux';
import { VizTypePicker, getAllPanelPluginMeta, filterPluginList } from '../VizTypePicker/VizTypePicker';
import { Field } from '@grafana/ui/src/components/Forms/Field';
import { setPanelEditorUIState, toggleVizPicker } from './state/reducers';
import { selectors } from '@grafana/e2e-selectors';
import { PanelLibraryOptionsGroup } from 'app/features/library-panels/components/PanelLibraryOptionsGroup/PanelLibraryOptionsGroup';

interface OwnProps {
  panel: PanelModel;
}

interface ConnectedProps {
  plugin?: PanelPlugin;
  isVizPickerOpen: boolean;
  isPanelOptionsVisible: boolean;
}

interface DispatchProps {
  changePanelPlugin: typeof changePanelPlugin;
  toggleVizPicker: typeof toggleVizPicker;
  setPanelEditorUIState: typeof setPanelEditorUIState;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

export const VisualizationButtonUnconnected: FC<Props> = ({
  panel,
  plugin,
  changePanelPlugin,
  toggleVizPicker,
  isPanelOptionsVisible,
  isVizPickerOpen,
  setPanelEditorUIState,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [listMode, setListMode] = useState('types');
  const styles = useStyles(getStyles);

  const onPluginTypeChange = (meta: PanelPluginMeta) => {
    if (meta.id === plugin!.meta.id) {
      toggleVizPicker(false);
    } else {
      changePanelPlugin(panel, meta.id);
    }
  };

  const onToggleOpen = () => {
    toggleVizPicker(!isVizPickerOpen);
  };

  const onKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const query = e.currentTarget.value;
        const plugins = getAllPanelPluginMeta();
        const match = filterPluginList(plugins, query, plugin!.meta);
        if (match && match.length) {
          onPluginTypeChange(match[0]);
        }
      }
    },
    [onPluginTypeChange, plugin]
  );

  const onToggleOptionsPane = () => {
    setPanelEditorUIState({ isPanelOptionsVisible: !isPanelOptionsVisible });
  };

  if (!plugin) {
    return null;
  }

  const suffix =
    searchQuery !== '' ? (
      <Button icon="times" variant="link" size="sm" onClick={() => setSearchQuery('')}>
        Clear filter
      </Button>
    ) : null;

  const radioOptions: Array<SelectableValue<string>> = [
    { label: 'Visualizations', value: 'types' },
    { label: 'Libray', value: 'library' },
    { label: 'Explore', value: 'explore' },
  ];

  return (
    <div className={styles.wrapper}>
      {!isVizPickerOpen && (
        <ButtonGroup>
          <ToolbarButton
            className={styles.vizButton}
            tooltip="Click to change visualisation"
            imgSrc={plugin.meta.info.logos.small}
            isOpen={isVizPickerOpen}
            onClick={onToggleOpen}
            aria-label={selectors.components.PanelEditor.toggleVizPicker}
            fullWidth
          >
            {plugin.meta.name}
          </ToolbarButton>
          <ToolbarButton
            tooltip={isPanelOptionsVisible ? 'Close options pane' : 'Show options pane'}
            icon="angle-right"
            onClick={onToggleOptionsPane}
            aria-label={selectors.components.PanelEditor.toggleVizOptions}
          />
        </ButtonGroup>
      )}
      {isVizPickerOpen && (
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
            </CustomScrollbar>
          </div>
        </div>
      )}
    </div>
  );
};

VisualizationButtonUnconnected.displayName = 'VisualizationTabUnconnected';

const getStyles = (theme: GrafanaTheme) => {
  return {
    icon: css`
      color: ${theme.palette.gray33};
    `,
    wrapper: css`
      display: flex;
      flex-direction: column;
    `,
    vizButton: css`
      text-align: left;
    `,
    scrollWrapper: css`
      flex-grow: 1;
    `,
    openWrapper: css`
      flex-grow: 1;
      background: ${theme.colors.bg1};
      border: 1px solid ${theme.colors.border1};
      padding: ${theme.spacing.sm};
    `,
    customFieldMargin: css`
      margin-bottom: ${theme.spacing.sm};
    `,
    formBox: css`
      margin-bottom: ${theme.spacing.md};
    `,
  };
};

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state, props) => {
  return {
    plugin: state.plugins.panels[props.panel.type],
    isPanelOptionsVisible: state.panelEditor.ui.isPanelOptionsVisible,
    isVizPickerOpen: state.panelEditor.isVizPickerOpen,
  };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  changePanelPlugin,
  toggleVizPicker,
  setPanelEditorUIState,
};

export const VisualizationButton = connect(mapStateToProps, mapDispatchToProps, undefined, { forwardRef: true })(
  VisualizationButtonUnconnected
);
