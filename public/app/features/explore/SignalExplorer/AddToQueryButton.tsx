import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, Tooltip, useStyles2 } from '@grafana/ui';

import { type AddToQueryItemType } from './types';

interface Props {
  text: string;
  itemType: AddToQueryItemType;
  /** Names the item, since every row shares the same tooltip. */
  ariaLabel: string;
  onAdd: (text: string, itemType: AddToQueryItemType) => void;
}

/** Hidden until its row reveals it: spread `getAddToQueryReveal` into the row's styles. */
export function AddToQueryButton({ text, itemType, ariaLabel, onAdd }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <span className={styles.wrapper}>
      <Tooltip content={t('explore.signal-explorer.add-to-query', 'Add to query')}>
        <IconButton name="plus" size="sm" aria-label={ariaLabel} onClick={() => onAdd(text, itemType)} />
      </Tooltip>
    </span>
  );
}

// A wrapper rather than IconButton's own className: `cx` merges Emotion classes into a new one,
// so a selector on this class would never match the button.
// Hidden by collapsing its width rather than with `display` or `visibility`, which would take the
// button out of the tab order and leave `:focus-visible` nothing to reveal.
const getStyles = () => ({
  wrapper: css({
    label: 'signal-explorer-add-to-query',
    display: 'flex',
    flexShrink: 0,
    width: 0,
    overflow: 'hidden',
  }),
});

/** Row styles that show the button on hover or keyboard focus, and always where nothing can hover. */
export const getAddToQueryReveal = (theme: GrafanaTheme2) => {
  // Emotion derives the class from the styles, so this is the class the button's wrapper renders with.
  const revealed = {
    [`.${getStyles().wrapper}`]: { width: 'auto', overflow: 'visible', padding: theme.spacing(0, 0.5) },
  };

  return {
    '&:hover, &:has(:focus-visible)': revealed,
    '@media (hover: none)': revealed,
  };
};
