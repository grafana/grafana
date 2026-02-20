import { css, cx } from '@emotion/css';
import { useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { GroupByVariable, VariableValueOption, VariableValueSingle } from '@grafana/scenes';
import { Button, Checkbox, ClickOutsideWrapper, FilterInput, Stack, useStyles2 } from '@grafana/ui';

interface Props {
  groupByVariable: GroupByVariable;
  onCancel: () => void;
  isLoading: boolean;
  searchValue: string;
  setSearchValue: (value: string) => void;
  options: VariableValueOption[];
  values: VariableValueSingle[];
  onValuesChange: (value: VariableValueSingle[]) => void;
}

export function PanelGroupByActionPopover({
  groupByVariable,
  onCancel,
  isLoading,
  searchValue,
  setSearchValue,
  options,
  values,
  onValuesChange,
}: Props) {
  const styles = useStyles2(getStyles);

  const onCheckedChanged = useCallback(
    (option: VariableValueOption) => (event: React.FormEvent<HTMLInputElement>) => {
      const newValues = event.currentTarget.checked
        ? values.concat(option.value)
        : values.filter((c) => c !== option.value);

      onValuesChange(newValues);
    },
    [onValuesChange, values]
  );

  const isChecked = (option: VariableValueOption) => {
    return values.includes(option.value);
  };

  const handleApply = useCallback(() => {
    if (!values.length) {
      return;
    }

    groupByVariable.changeValueTo(values, values.map(String), true);
    onCancel();
  }, [groupByVariable, onCancel, values]);

  const isAnyOptionChecked = () => {
    if (!values.length) {
      return false;
    }

    return values.some((value) => options.find((option) => option.value === value));
  };

  return (
    <ClickOutsideWrapper onClick={onCancel} useCapture={true}>
      {/* This is just blocking click events from bubbeling and should not have a keyboard interaction. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div className={styles.menuContainer} onClick={(ev) => ev.stopPropagation()}>
        <Stack direction="column">
          <div className={styles.searchContainer}>
            <FilterInput
              placeholder={t('panel-group-by.search-placeholder', 'Search')}
              value={searchValue}
              onChange={setSearchValue}
              escapeRegex={false}
            />
          </div>

          <div className={styles.listContainer}>
            {isLoading ? (
              <div className={styles.emptyMessage}>
                <Trans i18nKey="panel-group-by.loading">Loading options</Trans>
              </div>
            ) : options.length === 0 ? (
              <div className={styles.emptyMessage}>
                <Trans i18nKey="panel-group-by.no-options">No options found</Trans>
              </div>
            ) : (
              options.map((option) => {
                return (
                  <div key={String(option.value)} className={cx(styles.option)}>
                    <Checkbox value={isChecked(option)} label={option.label} onChange={onCheckedChanged(option)} />
                  </div>
                );
              })
            )}
          </div>

          <Stack justifyContent="end" direction="row-reverse">
            <Button size="sm" onClick={handleApply} disabled={!isAnyOptionChecked()}>
              <Trans i18nKey="grafana-ui.table.filter-popup-apply">Ok</Trans>
            </Button>
            <Button size="sm" variant="secondary" onClick={onCancel}>
              <Trans i18nKey="grafana-ui.table.filter-popup-cancel">Cancel</Trans>
            </Button>
          </Stack>
        </Stack>
      </div>
    </ClickOutsideWrapper>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  menuContainer: css({
    display: 'flex',
    flexDirection: 'column',
    background: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    padding: theme.spacing(2),
  }),
  searchContainer: css({
    width: '100%',
    paddingBottom: theme.spacing(1),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  listContainer: css({
    flex: 1,
    overflow: 'auto',
    minHeight: '100px',
    maxHeight: '300px',
    padding: theme.spacing(0.5),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
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
  emptyMessage: css({
    padding: theme.spacing(2),
    textAlign: 'center',
    color: theme.colors.text.secondary,
  }),
});
