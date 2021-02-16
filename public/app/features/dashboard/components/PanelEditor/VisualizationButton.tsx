import React, { useCallback, useState } from 'react';
import { css } from 'emotion';
import { GrafanaTheme, PanelPlugin, PanelPluginMeta } from '@grafana/data';
import { useTheme, stylesFactory, Icon, Input, ToolbarButton, ToolbarButtonRow, ButtonGroup } from '@grafana/ui';
import { changePanelPlugin } from '../../state/actions';
import { StoreState } from 'app/types';
import { PanelModel } from '../../state/PanelModel';
import { connect, MapStateToProps, MapDispatchToProps } from 'react-redux';
import { VizTypePicker, getAllPanelPluginMeta, filterPluginList } from '../VizTypePicker/VizTypePicker';
import { Field } from '@grafana/ui/src/components/Forms/Field';

interface OwnProps {
  panel: PanelModel;
  isOptionsPaneOpen: boolean;
  onToggleOptionsPane: () => void;
}

interface ConnectedProps {
  plugin?: PanelPlugin;
}

interface DispatchProps {
  changePanelPlugin: typeof changePanelPlugin;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

export const VisualizationButtonUnconnected = React.forwardRef<HTMLInputElement, Props>(
  ({ panel, plugin, changePanelPlugin, onToggleOptionsPane, isOptionsPaneOpen }, ref) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const theme = useTheme();
    const styles = getStyles(theme);

    const onPluginTypeChange = (meta: PanelPluginMeta) => {
      if (meta.id === plugin!.meta.id) {
        setIsOpen(false);
      } else {
        changePanelPlugin(panel, meta.id);
      }
    };

    const onToggleOpen = () => {
      setIsOpen(!isOpen);
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

    if (!plugin) {
      return null;
    }

    const suffix =
      searchQuery !== '' ? (
        <span className={styles.searchClear} onClick={() => setSearchQuery('')}>
          <Icon name="times" />
          Clear filter
        </span>
      ) : null;

    return (
      <div className={styles.wrapper}>
        <ButtonGroup>
          <ToolbarButton
            tooltip="Click to change visualisation"
            imgSrc={plugin.meta.info.logos.small}
            isOpen={isOpen}
            onClick={onToggleOpen}
            fullWidth
          >
            {plugin.meta.name}
          </ToolbarButton>
          <ToolbarButton
            tooltip={isOptionsPaneOpen ? 'Close options pane' : 'Show options pane'}
            icon="sliders-v-alt"
            onClick={onToggleOptionsPane}
            isOpen={isOptionsPaneOpen}
          />
        </ButtonGroup>
        {isOpen && (
          <>
            <Field>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
                onKeyPress={onKeyPress}
                prefix={<Icon name="filter" className={styles.icon} />}
                suffix={suffix}
                placeholder="Filter visualizations"
                ref={ref}
              />
            </Field>

            <VizTypePicker
              current={plugin.meta}
              onTypeChange={onPluginTypeChange}
              searchQuery={searchQuery}
              onClose={() => {}}
            />
          </>
        )}
      </div>
    );
  }
);

VisualizationButtonUnconnected.displayName = 'VisualizationTabUnconnected';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    icon: css`
      color: ${theme.palette.gray33};
    `,
    wrapper: css`
      display: flex;
      flex-direction: column;
    `,
    searchClear: css`
      color: ${theme.palette.gray60};
      cursor: pointer;
    `,
  };
});

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state, props) => {
  return {
    plugin: state.plugins.panels[props.panel.type],
  };
};

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = { changePanelPlugin };

export const VisualizationButton = connect(mapStateToProps, mapDispatchToProps, undefined, { forwardRef: true })(
  VisualizationButtonUnconnected
);
