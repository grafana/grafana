import { css } from '@emotion/css';
import { useMemo } from 'react';

import type { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Combobox, type ComboboxOption, IconButton, useStyles2 } from '@grafana/ui';

interface ChipSelectProps {
  'aria-label': string;
  options: SelectableValue[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  addPlaceholder: string;
  listLabel: string;
}

const getStyles = (theme: GrafanaTheme2) => ({
  chipList: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
    listStyle: 'none',
    margin: theme.spacing(1, 0, 0),
    padding: 0,
  }),
  chip: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    maxWidth: '100%',
    padding: theme.spacing(0.25, 0.5, 0.25, 1),
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  chipLabel: css({
    wordBreak: 'break-word',
  }),
});

/**
 * Multi-select rendered as a "pick one to add" Combobox plus a wrapping list of removable chips.
 * MultiCombobox collapses its pills onto one line, which truncates every label in the narrow filter pane.
 */
export function ChipSelect({
  'aria-label': ariaLabel,
  options,
  selected,
  onChange,
  placeholder,
  addPlaceholder,
  listLabel,
}: ChipSelectProps) {
  const styles = useStyles2(getStyles);

  const comboboxOptions = useMemo<Array<ComboboxOption<string>>>(
    () =>
      options.flatMap((opt) =>
        opt.value != null ? [{ value: String(opt.value), label: opt.label ?? String(opt.value) }] : []
      ),
    [options]
  );

  const unselectedOptions = useMemo(() => {
    const selectedSet = new Set(selected);
    return comboboxOptions.filter((opt) => !selectedSet.has(opt.value));
  }, [comboboxOptions, selected]);

  const labelFor = (value: string) => comboboxOptions.find((opt) => opt.value === value)?.label ?? value;

  return (
    <>
      <Combobox<string>
        aria-label={ariaLabel}
        options={unselectedOptions}
        value={null}
        onChange={(option) => onChange([...selected, option.value])}
        placeholder={selected.length > 0 ? addPlaceholder : placeholder}
      />
      {selected.length > 0 && (
        <ul className={styles.chipList} aria-label={listLabel}>
          {selected.map((value) => {
            const label = labelFor(value);
            return (
              <li key={value} className={styles.chip}>
                <span className={styles.chipLabel}>{label}</span>
                <IconButton
                  name="times"
                  size="sm"
                  aria-label={t('connections.add-new-connection.remove-filter-value', 'Remove {{label}}', { label })}
                  onClick={() => onChange(selected.filter((v) => v !== value))}
                />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
