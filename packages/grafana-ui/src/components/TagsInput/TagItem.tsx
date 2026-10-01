import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { getTagColorsFromName } from '../../utils/tags';
import { IconButton } from '../IconButton/IconButton';

interface Props {
  name: string;
  disabled?: boolean;
  onRemove: (tag: string) => void;

  /** Colours the tags 'randomly' based on the name. Defaults to true */
  autoColors?: boolean;
}

/**
 * @internal
 * Only used internally by TagsInput
 * */
export const TagItem = ({ name, disabled, onRemove, autoColors = true }: Props) => {
  const styles = useStyles2(getStyles, autoColors, disabled, name);

  return (
    <li className={styles.itemStyle}>
      <span className={styles.nameStyle}>{name}</span>
      <IconButton
        name="times"
        size="lg"
        disabled={disabled}
        aria-label={t('grafana-ui.tags-input.remove', 'Remove tag: {{name}}', { name })}
        onClick={() => onRemove(name)}
        className={styles.buttonStyles}
      />
    </li>
  );
};

const getStyles = (theme: GrafanaTheme2, autoColors?: Boolean, disabled?: Boolean, name?: string) => {
  const height = theme.spacing.gridSize * 3;
  const visualRefreshEnabled = theme.flags.visualDesignRefresh;

  let backgroundColor = theme.colors.background.secondary;
  let borderColor = theme.components.input.borderColor;
  let textColor = theme.colors.text.primary;

  if (autoColors) {
    const { background, text } = getTagColorsFromName(name, theme);
    backgroundColor = background;
    textColor = text;
    borderColor = theme.colors.emphasize(backgroundColor, 0.2);
  }

  return {
    itemStyle: css(
      {
        display: 'flex',
        gap: '3px',
        alignItems: 'center',
        height: `${height}px`,
        lineHeight: `${height - 2}px`,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderRadius: theme.shape.radius.default,
        padding: `0 ${theme.spacing(0.5)}`,
        whiteSpace: 'nowrap',
        textShadow: 'none',
        fontWeight: 500,
        fontSize: theme.typography.size.sm,
        color: textColor,
        borderColor,
        backgroundColor,
      },
      visualRefreshEnabled && {
        borderWidth: 0,
        borderRadius: theme.shape.radius.pill,
        padding: `0 ${theme.spacing.x1}`,
        fontSize: theme.typography.size.xs,
        color: disabled ? theme.colors.text.disabled : textColor,
      }
    ),
    nameStyle: css({
      maxWidth: '25ch',
      textOverflow: 'ellipsis',
      overflow: 'hidden',
    }),
    buttonStyles: css(
      {
        margin: 0,
        '&:hover::before': {
          display: 'none',
        },
      },
      // Lets the close icon pick up the tag's own text color instead of IconButton's default variant color.
      visualRefreshEnabled && {
        color: 'inherit',
      }
    ),
  };
};
