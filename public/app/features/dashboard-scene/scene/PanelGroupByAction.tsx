import { css, cx } from '@emotion/css';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { lastValueFrom } from 'rxjs';

import { GrafanaTheme2, fuzzySearch } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import {
  GroupByVariable,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  VariableValueOption,
  VariableValueSingle,
  VizPanel,
} from '@grafana/scenes';
import { Button, Icon, Input, useStyles2, Checkbox, Dropdown, Stack } from '@grafana/ui';

interface OptionWithChecked extends VariableValueOption {
  checked: boolean;
}
export class PanelGroupByAction extends SceneObjectBase {
  static Component = PanelGroupByActionRenderer;

  private _groupByVariable: GroupByVariable | undefined;

  constructor() {
    super({});
    this.addActivationHandler(this.onActivate);
  }

  private onActivate = () => {
    const panel = this.parent;
    if (!panel || !(panel instanceof VizPanel)) {
      throw new Error('PanelGroupByAction can be used only for VizPanel');
    }

    this._groupByVariable = sceneGraph
      .getVariables(this)
      .state.variables.find((variable) => variable instanceof GroupByVariable);
  };

  public getGroupByVariable() {
    return this._groupByVariable;
  }

  public doesPanelSupportGroupByVariable() {
    const panel = this.parent;
    if (!panel || !(panel instanceof VizPanel)) {
      throw new Error('PanelGroupByAction can be used only for VizPanel');
    }

    const dsUid = sceneGraph.getData(panel).state.data?.request?.targets?.[0]?.datasource?.uid;

    if (!this._groupByVariable) {
      return false;
    }

    return sceneGraph.interpolate(this._groupByVariable, this._groupByVariable.state.datasource?.uid) === dsUid;
  }

  public async getGroupByOptions() {
    if (
      this._groupByVariable &&
      (!this._groupByVariable.state.options || this._groupByVariable.state.options.length === 0)
    ) {
      await lastValueFrom(this._groupByVariable.validateAndUpdate());
    }

    const options = this._groupByVariable?.state.options;

    if (!options || options.length === 0) {
      return [];
    }

    const data = sceneGraph.getData(this);
    const queries = data.state.data?.request?.targets;

    if (!queries || queries.length === 0) {
      return options;
    }

    const values = options.map((option) => option.value);
    const applicability = await this._groupByVariable?.getGroupByApplicabilityForQueries(values, queries);

    if (!applicability) {
      return options;
    }

    return applicability.filter((item) => item.applicable).map((item) => ({ label: item.key, value: item.key }));
  }
}

function PanelGroupByActionRenderer({ model }: SceneComponentProps<PanelGroupByAction>) {
  const groupByState = model.getGroupByVariable()?.useState();
  const dataState = sceneGraph.getData(model).useState();
  const styles = useStyles2(getStyles);
  const panelHasGroupBy = model.doesPanelSupportGroupByVariable();

  const [options, setOptions] = useState<OptionWithChecked[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleItemClick = useCallback((item: OptionWithChecked) => {
    setOptions((prevOptions) =>
      prevOptions.map((opt) => (opt.value === item.value ? { ...opt, checked: !opt.checked } : opt))
    );
  }, []);

  const handleApply = useCallback(() => {
    const selectedValues: VariableValueSingle[] = [];
    const selectedLabels: string[] = [];

    for (const option of options) {
      if (option.checked) {
        selectedValues.push(option.value);
        selectedLabels.push(option.label);
      }
    }

    if (!selectedValues.length) {
      return;
    }

    const groupByVariable = model.getGroupByVariable();

    if (groupByVariable) {
      groupByVariable.changeValueTo(selectedValues, selectedLabels, true);
    }
  }, [model, options]);

  const handleVisibilityChange = useCallback((visible: boolean) => {
    setIsOpen(visible);
    if (!visible) {
      setSearchValue('');
    }
  }, []);

  useEffect(() => {
    const fetchOptions = async () => {
      setIsLoading(true);
      try {
        const applicableOptions = await model.getGroupByOptions();
        const currentValue = groupByState?.value || [];
        const currentValues = Array.isArray(currentValue) ? currentValue : [currentValue];

        const optionsWithChecked: OptionWithChecked[] = applicableOptions.map((opt) => ({
          ...opt,
          checked: currentValues.includes(opt.value),
        }));

        setOptions(optionsWithChecked);
      } catch (error) {
        setOptions([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      fetchOptions();
    }
  }, [model, groupByState?.value, dataState.data?.request?.targets, isOpen]);

  const filteredOptions = useMemo(() => {
    if (!searchValue) {
      return options;
    }

    const haystack = options.map((option) => option.label);
    const indices = fuzzySearch(haystack, searchValue);
    return indices.map((idx) => options[idx]);
  }, [options, searchValue]);

  const hasCheckedOptions = useMemo(() => {
    return options.some((opt) => opt.checked);
  }, [options]);

  if (!groupByState || !panelHasGroupBy) {
    return null;
  }

  const overlayContent = () => (
    <div className={styles.menuContainer}>
      <Stack
        direction="column"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Tab') {
            e.stopPropagation();
          }
        }}
      >
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
          ) : filteredOptions.length === 0 ? (
            <div className={styles.emptyMessage}>
              <Trans i18nKey="panel-group-by.no-options">No options found</Trans>
            </div>
          ) : (
            filteredOptions.map((option) => {
              return (
                <div
                  key={String(option.value)}
                  className={cx(styles.option)}
                  onClick={() => handleItemClick(option)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleItemClick(option);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={option.checked}
                >
                  <Checkbox value={option.checked} onChange={() => handleItemClick(option)} />
                  <span className={styles.optionLabel}>{option.label}</span>
                </div>
              );
            })
          )}
        </div>
      </Stack>
      <div className={styles.applyContainer}>
        <Button onClick={handleApply} disabled={!hasCheckedOptions}>
          <Trans i18nKey="panel-group-by.apply">Apply</Trans>
        </Button>
        <Button variant="secondary" fill="outline">
          <Trans i18nKey="panel-group-by.cancel">Cancel</Trans>
        </Button>
      </div>
    </div>
  );

  return (
    <Dropdown overlay={overlayContent} placement="bottom-start" onVisibleChange={handleVisibilityChange}>
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
    minHeight: '100px',
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
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.border}`,
      outlineOffset: '-2px',
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
