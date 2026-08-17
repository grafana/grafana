import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

/**
 * Renders notebook tags in one neutral colour instead of the colour-per-name `Tag` gives by default,
 * so a tag reads the same in the document header, in the notebooks list, and beside the edit-mode
 * picker — whose chips are neutral because that is what `ValuePill` looks like.
 *
 * Applied as a class rather than through `TagList`'s `getColorIndex`, which looks the obvious way to do
 * it and does not work: that prop only picks an entry out of `theme.components.tag.colors`, and the
 * visual-refresh themes replace that palette with 22 colours of which none is neutral — index 9, the
 * grey in the default palette, is lavender there. There is no index that is neutral across themes.
 *
 * `Tag` sets its background and colour from a single class, so this descendant rule outranks it on
 * specificity. The query library flattens its tags the same way, for the same reason.
 */
export const getNeutralTagListStyle = (theme: GrafanaTheme2) =>
  css({
    span: {
      backgroundColor: theme.colors.background.secondary,
      color: theme.colors.text.primary,
    },
  });
