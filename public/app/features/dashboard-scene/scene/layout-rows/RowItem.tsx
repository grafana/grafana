import { css, cx } from '@emotion/css';
import { ReactNode, useMemo, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  SceneObjectState,
  SceneObjectBase,
  SceneComponentProps,
  sceneGraph,
  VariableDependencyConfig,
  SceneObject,
} from '@grafana/scenes';
import {
  Alert,
  Button,
  Icon,
  Input,
  RadioButtonGroup,
  Switch,
  TextLink,
  useElementSelection,
  useStyles2,
} from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { RepeatRowSelect2 } from 'app/features/dashboard/components/RepeatRowSelect/RepeatRowSelect';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { isClonedKey } from '../../utils/clone';
import { getDashboardSceneFor, getDefaultVizPanel, getQueryRunnerFor } from '../../utils/utils';
import { DashboardScene } from '../DashboardScene';
import { useLayoutCategory } from '../layouts-shared/DashboardLayoutSelector';
import { BulkActionElement } from '../types/BulkActionElement';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { EditableDashboardElement } from '../types/EditableDashboardElement';
import { LayoutParent } from '../types/LayoutParent';

import { MultiSelectedRowItemsElement } from './MultiSelectedRowItemsElement';
import { RowItemRepeaterBehavior } from './RowItemRepeaterBehavior';
import { RowsLayoutManager } from './RowsLayoutManager';

export interface RowItemState extends SceneObjectState {
  layout: DashboardLayoutManager;
  title?: string;
  isCollapsed?: boolean;
  isHeaderHidden?: boolean;
  height?: 'expand' | 'min';
}

export class RowItem
  extends SceneObjectBase<RowItemState>
  implements LayoutParent, BulkActionElement, EditableDashboardElement
{
  protected _variableDependency = new VariableDependencyConfig(this, {
    statePaths: ['title'],
  });

  public readonly isEditableDashboardElement = true;
  public readonly typeName = 'Row';

  public useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    const row = this;

    const rowOptions = useMemo(() => {
      return new OptionsPaneCategoryDescriptor({
        title: 'Row options',
        id: 'row-options',
        isOpenDefault: true,
      })
        .addItem(
          new OptionsPaneItemDescriptor({
            title: 'Title',
            render: () => <RowTitleInput row={row} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: 'Height',
            render: () => <RowHeightSelect row={row} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: 'Hide row header',
            render: () => <RowHeaderSwitch row={row} />,
          })
        );
    }, [row]);

    const rowRepeatOptions = useMemo(() => {
      const dashboard = getDashboardSceneFor(row);

      return new OptionsPaneCategoryDescriptor({
        title: 'Repeat options',
        id: 'row-repeat-options',
        isOpenDefault: true,
      }).addItem(
        new OptionsPaneItemDescriptor({
          title: 'Variable',
          render: () => <RowRepeatSelect row={row} dashboard={dashboard} />,
        })
      );
    }, [row]);

    const { layout } = this.useState();
    const layoutOptions = useLayoutCategory(layout);

    return [rowOptions, rowRepeatOptions, layoutOptions];
  }

  public createMultiSelectedElement(items: SceneObject[]) {
    return new MultiSelectedRowItemsElement(items);
  }

  public onDelete = () => {
    const layout = sceneGraph.getAncestor(this, RowsLayoutManager);
    layout.removeRow(this);
  };

  public renderActions(): ReactNode {
    return (
      <>
        <Button size="sm" variant="secondary" icon="copy" />
        <Button size="sm" variant="destructive" fill="outline" onClick={this.onDelete} icon="trash-alt" />
      </>
    );
  }

  public getLayout(): DashboardLayoutManager {
    return this.state.layout;
  }

  public switchLayout(layout: DashboardLayoutManager): void {
    this.setState({ layout });
  }

  public onCollapseToggle = () => {
    this.setState({ isCollapsed: !this.state.isCollapsed });
  };

  public onAddPanel = (vizPanel = getDefaultVizPanel()) => {
    this.getLayout().addPanel(vizPanel);
  };

  public static Component = ({ model }: SceneComponentProps<RowItem>) => {
    const { layout, title, isCollapsed, height = 'expand', isHeaderHidden, key } = model.useState();
    const isClone = useMemo(() => isClonedKey(key!), [key]);
    const dashboard = getDashboardSceneFor(model);
    const { isEditing, showHiddenElements } = dashboard.useState();
    const styles = useStyles2(getStyles);
    const titleInterpolated = sceneGraph.interpolate(model, title, undefined, 'text');
    const ref = useRef<HTMLDivElement>(null);
    const shouldGrow = !isCollapsed && height === 'expand';
    const { isSelected, onSelect } = useElementSelection(key);

    return (
      <div
        className={cx(
          styles.wrapper,
          isCollapsed && styles.wrapperCollapsed,
          shouldGrow && styles.wrapperGrow,
          !isClone && isSelected && 'dashboard-selected-element'
        )}
        ref={ref}
      >
        {(!isHeaderHidden || (isEditing && showHiddenElements)) && (
          <div className={styles.rowHeader}>
            <button
              onClick={model.onCollapseToggle}
              className={styles.rowTitleButton}
              aria-label={isCollapsed ? 'Expand row' : 'Collapse row'}
              data-testid={selectors.components.DashboardRow.title(titleInterpolated!)}
            >
              <Icon name={isCollapsed ? 'angle-right' : 'angle-down'} />
              <span className={styles.rowTitle} role="heading">
                {titleInterpolated}
              </span>
            </button>
            {!isClone && isEditing && (
              <Button icon="pen" variant="secondary" size="sm" fill="text" onPointerDown={(evt) => onSelect?.(evt)} />
            )}
          </div>
        )}
        {!isCollapsed && <layout.Component model={layout} />}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    rowHeader: css({
      width: '100%',
      display: 'flex',
      gap: theme.spacing(1),
      padding: theme.spacing(0, 0, 0.5, 0),
      margin: theme.spacing(0, 0, 1, 0),
      alignItems: 'center',

      '&:hover, &:focus-within': {
        '& > div': {
          opacity: 1,
        },
      },

      '& > div': {
        marginBottom: 0,
        marginRight: theme.spacing(1),
      },
    }),
    rowTitleButton: css({
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      background: 'transparent',
      border: 'none',
      minWidth: 0,
      gap: theme.spacing(1),
    }),
    rowTitle: css({
      fontSize: theme.typography.h5.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: '100%',
      flexGrow: 1,
      minWidth: 0,
    }),
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      minHeight: '100px',
    }),
    wrapperGrow: css({
      flexGrow: 1,
    }),
    wrapperCollapsed: css({
      flexGrow: 0,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      minHeight: 'unset',
    }),
    rowActions: css({
      display: 'flex',
      opacity: 0,
    }),
  };
}

export function RowTitleInput({ row }: { row: RowItem }) {
  const { title } = row.useState();

  return <Input value={title} onChange={(e) => row.setState({ title: e.currentTarget.value })} />;
}

export function RowHeaderSwitch({ row }: { row: RowItem }) {
  const { isHeaderHidden = false } = row.useState();

  return (
    <Switch
      value={isHeaderHidden}
      onChange={() => {
        row.setState({
          isHeaderHidden: !row.state.isHeaderHidden,
        });
      }}
    />
  );
}

export function RowHeightSelect({ row }: { row: RowItem }) {
  const { height = 'expand' } = row.useState();

  const options = [
    { label: 'Expand', value: 'expand' as const },
    { label: 'Min', value: 'min' as const },
  ];

  return (
    <RadioButtonGroup
      options={options}
      value={height}
      onChange={(option) =>
        row.setState({
          height: option,
        })
      }
    />
  );
}

export function RowRepeatSelect({ row, dashboard }: { row: RowItem; dashboard: DashboardScene }) {
  const { layout, $behaviors } = row.useState();

  let repeatBehavior: RowItemRepeaterBehavior | undefined = $behaviors?.find(
    (b) => b instanceof RowItemRepeaterBehavior
  );
  const { variableName } = repeatBehavior?.state ?? {};

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
        sceneContext={dashboard}
        repeat={variableName}
        onChange={(repeat) => {
          if (repeat) {
            // Remove repeat behavior if it exists to trigger repeat when adding new one
            if (repeatBehavior) {
              repeatBehavior.removeBehavior();
            }

            repeatBehavior = new RowItemRepeaterBehavior({ variableName: repeat });
            row.setState({ $behaviors: [...(row.state.$behaviors ?? []), repeatBehavior] });
            repeatBehavior.activate();
          } else {
            repeatBehavior?.removeBehavior();
          }
        }}
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
            <Trans i18nKey="dashboard.rows-layout.row.repeat.warning">
              Panels in this row use the {{ SHARED_DASHBOARD_QUERY }} data source. These panels will reference the panel
              in the original row, not the ones in the repeated rows.
            </Trans>
          </p>
          <TextLink
            external
            href={
              'https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/create-dashboard/#configure-repeating-rows'
            }
          >
            <Trans i18nKey="dashboard.rows-layout.row.repeat.learn-more">Learn more</Trans>
          </TextLink>
        </Alert>
      ) : undefined}
    </>
  );
}
