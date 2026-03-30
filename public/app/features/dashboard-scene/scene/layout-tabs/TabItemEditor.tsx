import { css, cx } from '@emotion/css';
import { useMemo, useRef, useSyncExternalStore } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Alert, Field, Input, TextLink, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { RepeatRowSelect2 } from 'app/features/dashboard/components/RepeatRowSelect/RepeatRowSelect';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { getTeamPalettesSnapshot, subscribeTeamPalettes } from '../../../teams/teamPalettesStore';
import { useConditionalRenderingEditor } from '../../conditional-rendering/hooks/useConditionalRenderingEditor';
import { dashboardEditActions } from '../../edit-pane/shared';
import { CLASSIC_PALETTE_ID, CUSTOM_PALETTES, PaletteDefinition } from '../../panel-edit/palettes';
import { getQueryRunnerFor } from '../../utils/utils';
import { useLayoutCategory } from '../layouts-shared/DashboardLayoutSelector';
import { generateUniqueTitle, useEditPaneInputAutoFocus } from '../layouts-shared/utils';

import { TabItem } from './TabItem';

export function useEditOptions(this: TabItem, isNewElement: boolean): OptionsPaneCategoryDescriptor[] {
  const model = this;
  const { layout } = model.useState();

  const tabCategory = useMemo(
    () =>
      new OptionsPaneCategoryDescriptor({ title: '', id: 'tab-item-options' }).addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.tabs-layout.tab-options.title-option', 'Title'),
          id: 'tab-options-title',
          render: (descriptor) => <TabTitleInput id={descriptor.props.id} tab={model} isNewElement={isNewElement} />,
        })
      ),
    [isNewElement, model]
  );

  const repeatCategory = useMemo(
    () =>
      new OptionsPaneCategoryDescriptor({
        title: t('dashboard.tabs-layout.tab-options.repeat.title', 'Repeat options'),
        id: 'repeat-options',
        isOpenDefault: false,
      }).addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.tabs-layout.tab-options.repeat.variable.title', 'Repeat by variable'),
          id: 'tab-options-repeat-variable',
          description: t(
            'dashboard.tabs-layout.tab-options.repeat.variable.description',
            'Repeat this tab for each value in the selected variable.'
          ),
          render: (descriptor) => <TabRepeatSelect id={descriptor.props.id} tab={model} />,
        })
      ),
    [model]
  );

  const layoutCategory = useLayoutCategory(layout);

  const visualizationCategory = useMemo(
    () =>
      new OptionsPaneCategoryDescriptor({
        title: t('dashboard.tabs-layout.tab-options.visualization.title', 'Visualization options'),
        id: 'visualization-options',
        isOpenDefault: true,
      }).addItem(
        new OptionsPaneItemDescriptor({
          title: t('dashboard.tabs-layout.tab-options.visualization.palette', 'Color palette'),
          id: 'tab-options-color-palette',
          render: () => <TabVisualizationOptions tab={model} />,
        })
      ),
    [model]
  );

  const editOptions = [tabCategory, ...layoutCategory, repeatCategory];

  const conditionalRenderingCategory = useMemo(
    () => useConditionalRenderingEditor(model.state.conditionalRendering),
    [model]
  );

  if (conditionalRenderingCategory) {
    editOptions.push(conditionalRenderingCategory);
  }

  editOptions.push(visualizationCategory);

  return editOptions;
}

function TabTitleInput({ tab, isNewElement, id }: { tab: TabItem; isNewElement: boolean; id?: string }) {
  const { title } = tab.useState();
  const prevTitle = useRef('');

  const ref = useEditPaneInputAutoFocus({ autoFocus: isNewElement });
  const hasUniqueTitle = tab.hasUniqueTitle();

  return (
    <Field
      invalid={!hasUniqueTitle}
      error={
        !hasUniqueTitle ? t('dashboard.tabs-layout.tab-options.title-not-unique', 'Title should be unique') : undefined
      }
    >
      <Input
        id={id}
        ref={ref}
        title={t('dashboard.tabs-layout.tab-options.title-option', 'Title')}
        value={title}
        onFocus={() => (prevTitle.current = title || '')}
        onBlur={() => editTabTitleAction(tab, title || '', prevTitle.current || '')}
        onChange={(e) => tab.onChangeTitle(e.currentTarget.value)}
        data-testid={selectors.components.PanelEditor.ElementEditPane.TabsLayout.titleInput}
      />
    </Field>
  );
}

function TabRepeatSelect({ tab, id }: { tab: TabItem; id?: string }) {
  const { layout } = tab.useState();

  const isAnyPanelUsingDashboardDS = layout.getVizPanels().some((vizPanel) => {
    const runner = getQueryRunnerFor(vizPanel);
    return (
      runner?.state.datasource?.uid === SHARED_DASHBOARD_QUERY ||
      (runner?.state.datasource?.uid === MIXED_DATASOURCE_NAME &&
        runner?.state.queries.some((query) => query.datasource?.uid === SHARED_DASHBOARD_QUERY))
    );
  });

  return (
    <>
      <RepeatRowSelect2
        id={id}
        sceneContext={tab}
        repeat={tab.state.repeatByVariable}
        onChange={(repeat) => tab.onChangeRepeat(repeat)}
      />
      {isAnyPanelUsingDashboardDS ? (
        <Alert
          data-testid={selectors.pages.Dashboard.Rows.Repeated.ConfigSection.warningMessage}
          severity="warning"
          title=""
          topSpacing={3}
          bottomSpacing={0}
        >
          <p>
            <Trans i18nKey="dashboard.tabs-layout.tab.repeat.warning">
              Panels in this tab use the {{ SHARED_DASHBOARD_QUERY }} data source. These panels will reference the panel
              in the original tab, not the ones in the repeated tabs.
            </Trans>
          </p>
          <TextLink
            external
            href={
              'https://grafana.com/docs/grafana/next/visualizations/dashboards/build-dashboards/create-dashboard/#repeating-rows-and-tabs-and-the-dashboard-special-data-source'
            }
          >
            <Trans i18nKey="dashboard.tabs-layout.tab.repeat.learn-more">Learn more</Trans>
          </TextLink>
        </Alert>
      ) : undefined}
    </>
  );
}

function TabVisualizationOptions({ tab }: { tab: TabItem }) {
  const { colorPalette } = tab.useState();
  const theme = useTheme2();
  const styles = useStyles2(getPaletteStyles);
  const teamPalettes = useSyncExternalStore(subscribeTeamPalettes, getTeamPalettesSnapshot);

  const classicPalette: PaletteDefinition = {
    id: CLASSIC_PALETTE_ID,
    name: t('dashboard.tabs-layout.tab-options.visualization.palette-classic', 'Classic'),
    colors: theme.visualization.palette.slice(0, 8),
  };

  const allPalettes: PaletteDefinition[] = [
    classicPalette,
    ...CUSTOM_PALETTES,
    ...teamPalettes.map((p) => ({ ...p, colors: p.colors.slice(0, 8) })),
  ];

  return (
    <div className={styles.grid}>
      {allPalettes.map((palette) => (
        <Tooltip key={palette.id} content={palette.name} placement="top">
          <button
            type="button"
            className={cx(styles.thumbnail, colorPalette === palette.id && styles.selected)}
            onClick={() => tab.onChangePalette(palette.id)}
            aria-label={palette.name}
            aria-pressed={colorPalette === palette.id}
          >
            {palette.colors.map((color, i) => (
              <span key={i} className={styles.swatch} style={{ backgroundColor: color }} />
            ))}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}

function getPaletteStyles(theme: GrafanaTheme2) {
  return {
    grid: css({
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: theme.spacing(0.75),
      width: '100%',
    }),
    thumbnail: css({
      display: 'flex',
      flexDirection: 'row',
      height: 56,
      width: '100%',
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
      border: `2px solid transparent`,
      cursor: 'pointer',
      padding: 0,
      background: 'none',
      outline: 'none',
      '&:hover': {
        border: `2px solid ${theme.colors.primary.border}`,
      },
      '&:focus-visible': {
        border: `2px solid ${theme.colors.primary.border}`,
      },
    }),
    selected: css({
      border: `2px solid ${theme.colors.primary.main}`,
    }),
    swatch: css({
      flex: 1,
      height: '100%',
    }),
  };
}

function editTabTitleAction(tab: TabItem, title: string, prevTitle: string) {
  if (title !== '' && title === prevTitle) {
    return;
  }

  if (title === '') {
    const tabs = tab.getParentLayout().getTabsIncludingRepeats();
    const existingNames = new Set(tabs.map((tab) => tab.state.title).filter((title) => title !== undefined));
    title = generateUniqueTitle('New tab', existingNames);
  }

  dashboardEditActions.edit({
    description: t('dashboard.edit-actions.tab-title', 'Change tab title'),
    source: tab,
    perform: () => tab.onChangeTitle(title),
    undo: () => tab.onChangeTitle(prevTitle),
  });
}
