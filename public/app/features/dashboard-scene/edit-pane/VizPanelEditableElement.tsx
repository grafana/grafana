import { css, cx } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2, textUtil } from '@grafana/data';
import { sceneGraph, VizPanel } from '@grafana/scenes';
import { useStyles2, Text, Icon, Stack, Tooltip } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import {
  PanelBackgroundSwitch,
  PanelDescriptionTextArea,
  PanelFrameTitleInput,
} from '../panel-edit/getPanelFrameOptions';
import { BulkActionElement } from '../scene/types/BulkActionElement';
import { isDashboardLayoutItem } from '../scene/types/DashboardLayoutItem';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../scene/types/EditableDashboardElement';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getEditPanelUrl } from '../utils/urlBuilders';
import { getPanelIdForVizPanel } from '../utils/utils';

import { EditPaneHeader } from './EditPaneHeader';

export class VizPanelEditableElement implements EditableDashboardElement, BulkActionElement {
  public readonly isEditableDashboardElement = true;
  public readonly typeName = 'Panel';

  public constructor(public panel: VizPanel) {}

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeId: 'panel',
      icon: 'chart-line',
      name: sceneGraph.interpolate(this.panel, this.panel.state.title, undefined, 'text'),
    };
  }

  public useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    const panel = this.panel;
    const layoutElement = panel.parent!;

    const panelOptions = useMemo(() => {
      return new OptionsPaneCategoryDescriptor({
        title: ``,
        id: 'panel-header',
        isOpenable: false,
        renderTitle: () => (
          <EditPaneHeader title={t('dashboard.viz-panel.options.title', 'Panel')} onDelete={() => this.onDelete()} />
        ),
      })
        .addItem(
          new OptionsPaneItemDescriptor({
            title: '',
            render: () => <OpenPanelEditViz panel={this.panel} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard.viz-panel.options.title-option', 'Title'),
            value: panel.state.title,
            popularRank: 1,
            render: () => <PanelFrameTitleInput panel={panel} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard.viz-panel.options.description', 'Description'),
            value: panel.state.description,
            render: () => <PanelDescriptionTextArea panel={panel} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: t('dashboard.viz-panel.options.transparent-background', 'Transparent background'),
            render: () => <PanelBackgroundSwitch panel={panel} />,
          })
        );
    }, [panel]);

    const layoutCategory = useMemo(() => {
      if (isDashboardLayoutItem(layoutElement) && layoutElement.getOptions) {
        return layoutElement.getOptions();
      }
      return undefined;
    }, [layoutElement]);

    const categories = [panelOptions];
    if (layoutCategory) {
      categories.push(layoutCategory);
    }

    return categories;
  }

  public onDelete() {
    const layout = dashboardSceneGraph.getLayoutManagerFor(this.panel);
    layout.removePanel?.(this.panel);
  }
}

type OpenPanelEditVizProps = {
  panel: VizPanel;
};

const OpenPanelEditViz = ({ panel }: OpenPanelEditVizProps) => {
  const styles = useStyles2(getStyles);

  const plugin = panel.getPlugin();
  const imgSrc = plugin?.meta.info.logos.small;

  return (
    <Stack alignItems="center" width="100%">
      {plugin ? (
        <Tooltip content={t('dashboard.viz-panel.options.open-edit', 'Open Panel Edit')}>
          <a
            href={textUtil.sanitizeUrl(getEditPanelUrl(getPanelIdForVizPanel(panel)))}
            className={cx(styles.pluginDescriptionWrapper)}
          >
            <img
              className={styles.panelVizImg}
              src={imgSrc}
              alt={t('dashboard.viz-panel.options.plugin-type-image', 'Image of plugin type')}
            />
            <Text truncate>{plugin.meta.name}</Text>
            <Icon className={styles.panelVizIcon} name="sliders-v-alt" />
          </a>
        </Tooltip>
      ) : null}
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  pluginDescriptionWrapper: css({
    display: 'flex',
    flexWrap: 'nowrap',
    alignItems: 'center',
    columnGap: theme.spacing(1),
    rowGap: theme.spacing(0.5),
    minHeight: theme.spacing(4),
    backgroundColor: theme.components.input.background,
    border: `1px solid ${theme.colors.border.strong}`,
    borderRadius: theme.shape.radius.default,
    paddingInline: theme.spacing(1),
    paddingBlock: theme.spacing(0.5),
    flexGrow: 1,
  }),
  panelVizImg: css({
    width: '16px',
    height: '16px',
    marginRight: theme.spacing(1),
  }),
  panelVizIcon: css({
    marginLeft: 'auto',
  }),
});
