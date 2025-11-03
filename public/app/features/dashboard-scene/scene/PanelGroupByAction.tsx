import { css, cx } from '@emotion/css';
import { useState, useCallback } from 'react';
import { lastValueFrom } from 'rxjs';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  GroupByVariable,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  VariableValueOption,
  VizPanel,
} from '@grafana/scenes';
import { Button, Dropdown, Icon, Input, useStyles2, Checkbox } from '@grafana/ui';

export class PanelGroupByAction extends SceneObjectBase {
  static Component = PanelGroupByActionRenderer;

  constructor() {
    super({});
    this.addActivationHandler(this.onActivate);
  }

  private onActivate = () => {
    const panel = this.parent;
    if (!panel || !(panel instanceof VizPanel)) {
      throw new Error('PanelGroupByAction can be used only for VizPanel');
    }
  };

  public getGroupByVariable() {
    return sceneGraph.getVariables(this).state.variables.find((variable) => variable instanceof GroupByVariable);
  }
}

function PanelGroupByActionRenderer({ model }: SceneComponentProps<PanelGroupByAction>) {
  const groupByVariable = model.getGroupByVariable();
  const groupByState = groupByVariable?.useState();
  const styles = useStyles2(getStyles);

  // Track temporary selections (not applied yet)
  const [tempSelectedItems, setTempSelectedItems] = useState<VariableValueOption[]>([]);
  // Track applied selections
  const [appliedSelectedItems, setAppliedSelectedItems] = useState<VariableValueOption[]>([]);
  // Track search input
  const [searchValue, setSearchValue] = useState('');
  // Track loading state
  const [isLoading, setIsLoading] = useState(false);

  // Check if an option is selected in temp state
  const isOptionSelected = useCallback(
    (item: VariableValueOption) => tempSelectedItems.some((opt) => opt.value === item.value),
    [tempSelectedItems]
  );

  // Toggle selection in temp state
  const handleItemClick = useCallback(
    (item: VariableValueOption) => {
      if (isOptionSelected(item)) {
        setTempSelectedItems(tempSelectedItems.filter((opt) => opt.value !== item.value));
      } else {
        setTempSelectedItems([...tempSelectedItems, item]);
      }
    },
    [isOptionSelected, tempSelectedItems]
  );

  // Apply selections and close dropdown
  const handleApply = () => {
    setAppliedSelectedItems(tempSelectedItems);
  };

  // When dropdown opens, fetch options if needed and sync temp state with applied state
  const handleOpenChange = async (open: boolean) => {
    if (open) {
      // If groupBy has no options, fetch them
      if (groupByVariable && (!groupByState?.options || groupByState.options.length === 0)) {
        setIsLoading(true);
        await lastValueFrom(groupByVariable.validateAndUpdate());
      }
      setTempSelectedItems(appliedSelectedItems);
      setSearchValue('');
    }
  };

  if (!groupByState) {
    return null;
  }

  const menu = (
    /* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
    <div className={styles.menuContainer} onClick={(e) => e.stopPropagation()}>
      <div className={styles.searchContainer}>
        <Input
          prefix={<Icon name="search" />}
          placeholder={t('panel-group-by.search-placeholder', 'Search...')}
          value={searchValue}
          onChange={(e) => setSearchValue(e.currentTarget.value)}
        />
      </div>
      <div className={styles.listContainer}>
        {isLoading ? (
          <div className={styles.emptyMessage}>
            <Trans i18nKey="panel-group-by.loading">Loading options...</Trans>
          </div>
        ) : groupByState.options.length === 0 ? (
          <div className={styles.emptyMessage}>
            <Trans i18nKey="panel-group-by.no-options">No options found</Trans>
          </div>
        ) : (
          groupByState.options.map((option) => {
            const isSelected = isOptionSelected(option);
            return (
              <div
                key={option.value as string}
                className={cx(styles.option)}
                onClick={(e) => {
                  e.stopPropagation();
                  handleItemClick(option);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleItemClick(option);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
              >
                <Checkbox value={isSelected} onChange={() => handleItemClick(option)} />
                <span className={styles.optionLabel}>{option.label}</span>
              </div>
            );
          })
        )}
      </div>
      <div className={styles.applyContainer}>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            handleApply();
          }}
        >
          <Trans i18nKey="panel-group-by.apply">Apply</Trans>
        </Button>
        <Button
          onClick={(e) => {
            e.stopPropagation();
          }}
          variant="secondary"
          fill="outline"
        >
          <Trans i18nKey="panel-group-by.cancel">Cancel</Trans>
        </Button>
      </div>
    </div>
  );

  return (
    <Dropdown overlay={menu} onVisibleChange={handleOpenChange} placement="bottom-start">
      <Button variant="secondary" size="sm">
        <Trans i18nKey="panel-group-by.button">Group by</Trans>
        <Icon name="angle-down" />
      </Button>
    </Dropdown>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  menuContainer: css({
    display: 'flex',
    flexDirection: 'column',
    width: '300px',
    maxHeight: '400px',
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
  }),
  searchContainer: css({
    padding: theme.spacing(1),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  listContainer: css({
    flex: 1,
    overflow: 'auto',
    minHeight: '200px',
    maxHeight: '300px',
    padding: theme.spacing(0.5),
  }),
  option: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    cursor: 'pointer',
    borderRadius: theme.shape.radius.default,
    '&:hover': {
      background: theme.colors.background.secondary,
    },
  }),
  optionLabel: css({
    flex: 1,
  }),
  emptyMessage: css({
    padding: theme.spacing(2),
    textAlign: 'center',
    color: theme.colors.text.secondary,
  }),
  applyContainer: css({
    display: 'flex',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
});
