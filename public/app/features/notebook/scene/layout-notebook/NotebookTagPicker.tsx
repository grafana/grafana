import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { MultiCombobox, useStyles2 } from '@grafana/ui';

import { useNotebookTagOptions } from './useNotebookTagOptions';

interface Props {
  id: string;
  /** Passed through rather than defaulted by the caller, so an untagged notebook keeps a stable value. */
  tags?: string[];
  onChange: (tags: string[]) => void;
}

/**
 * The document header's tag picker: a checkbox list of every tag in the library, with the notebook's
 * own ticked, rendered as chips on the page background rather than inside a form field.
 *
 * Mounted only while editing, which is what keeps the library request from firing on a notebook that
 * is only being read.
 *
 * One rough edge: MultiCombobox keeps whatever was typed after a tag is added, and keeps the list
 * filtered by it, so adding two tags in a row means clearing the field by hand in between. It is
 * internal state, cleared only on blur, so there is nothing to do about it from out here.
 */
export function NotebookTagPicker({ id, tags, onChange }: Props) {
  const styles = useStyles2(getStyles);
  const options = useNotebookTagOptions(tags);

  return (
    <div className={styles.inlinePicker}>
      <MultiCombobox
        id={id}
        options={options}
        value={tags}
        onChange={(selected) => onChange(normalizeTags(selected.map((option) => option.value)))}
        createCustomValue
        customValueDescription={t('dashboard.notebook-layout.tags-custom-value', 'Add as a new tag')}
        placeholder={t('dashboard.notebook-layout.tags-placeholder', 'Add a tag')}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  inlinePicker: css({
    width: '100%',
    // MultiCombobox takes no className, so a descendant selector is the only way in. Every bit of its
    // chrome - border, fill, radius, hover border, focus ring - sits on one inner div; the <input>
    // itself is already transparent, so that div is the whole job.
    //
    // `&&` doubles the specificity deliberately. The rules being overridden are several merged
    // single-class emotion rules, so a plain class would be settled by stylesheet insertion order
    // rather than by specificity.
    //
    // Matched by :has rather than a `> div > div` chain so that another wrapper appearing inside
    // grafana-ui cannot silently stop this from matching. It also matches the outer container div,
    // which is harmless - that one carries no chrome of its own.
    '&& div:has(input[role="combobox"])': {
      border: 'none',
      background: 'none',
      borderRadius: 'unset',
      // Zero horizontally so the chips start where the read-mode tags did and the row does not shift
      // sideways on entering edit mode. paddingRight is called out separately because the component
      // hardcodes 28px there to reserve room for the chevron hidden below.
      padding: theme.spacing(0.5, 0),
      paddingRight: 0,
      '&:hover': {
        border: 'none',
      },
      '&:focus-within': {
        outline: 'none',
        boxShadow: 'none',
      },
    },
    // The dropdown toggle. getToggleButtonProps sets role="button" and it is spread onto an svg, which
    // is what separates it from the chips' own remove control - that one is a <button>, so an
    // attribute selector does not match it.
    '&& svg[role="button"]': {
      display: 'none',
    },
  }),
});

/**
 * A custom value arrives as the raw string the user typed, so `latency ` would otherwise become a tag
 * that renders identically to `latency` but is not equal to it.
 *
 * Case is deliberately left alone. Lowercasing would also rewrite tags picked *from the dropdown* - a
 * notebook tagged `Production` would silently become `production` the moment anything else was
 * changed - and tags are case-sensitive everywhere else in Grafana.
 */
function normalizeTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}
