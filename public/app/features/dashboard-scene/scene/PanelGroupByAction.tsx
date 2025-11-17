import { css, cx } from '@emotion/css';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { lastValueFrom } from 'rxjs';

import { GrafanaTheme2, fuzzySearch } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { GroupByVariable, SceneDataQuery, VariableValueOption, VariableValueSingle } from '@grafana/scenes';
import { Button, Icon, Input, Checkbox, Dropdown, Stack, useStyles2 } from '@grafana/ui';

interface OptionWithChecked extends VariableValueOption {
  checked: boolean;
}

interface Props {
  groupByVariable: GroupByVariable;
  queries: SceneDataQuery[];
}

export function PanelGroupByAction({ groupByVariable, queries }: Props) {
  const styles = useStyles2(getStyles);

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

    groupByVariable.changeValueTo(selectedValues, selectedLabels, true);
  }, [groupByVariable, options]);

  const handleVisibilityChange = useCallback((visible: boolean) => {
    setIsOpen(visible);
    if (!visible) {
      setSearchValue('');
    }
  }, []);

  useEffect(() => {
    const fetchOptions = async () => {
      if (!groupByVariable) {
        return;
      }

      setIsLoading(true);
      try {
        const applicableOptions = await getGroupByOptions(groupByVariable, queries);
        const currentValue = groupByVariable.state.value || [];
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
  }, [isOpen, groupByVariable, queries]);

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
      <Button variant="secondary" size="sm" data-testid={selectors.components.Panels.Panel.PanelGroupByHeaderAction}>
        <Trans i18nKey="panel-group-by.button">Group by</Trans>
        <Icon name="angle-down" />
      </Button>
    </Dropdown>
  );
}

async function getGroupByOptions(groupByVariable: GroupByVariable, queries: SceneDataQuery[]) {
  if (!groupByVariable.state.options || groupByVariable.state.options.length === 0) {
    await lastValueFrom(groupByVariable.validateAndUpdate());
  }

  const options = groupByVariable.state.options;

  if (!options || options.length === 0) {
    return [];
  }

  const values = options.map((option) => option.value);
  const applicability = await groupByVariable.getGroupByApplicabilityForQueries(values, queries);

  if (!applicability) {
    return options;
  }

  return applicability.filter((item) => item.applicable).map((item) => ({ label: item.key, value: item.key }));
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
