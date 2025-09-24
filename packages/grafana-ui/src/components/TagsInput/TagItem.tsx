import { css, cx } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
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
  const styles = useStyles2(getStyles);

  // If configured, use random colors based on name.
  // Otherwise, a default class name will be applied to the tag.
  const tagStyle = useMemo(() => {
    if (autoColors) {
      const { color, borderColor } = getTagColorsFromName(name);
      return { backgroundColor: color, borderColor };
    }
    return undefined;
  }, [name, autoColors]);

  return (
    <li className={cx(styles.itemStyle, !tagStyle && styles.defaultTagColor)} style={tagStyle}>
      <span className={styles.nameStyle}>{name}</span>
      <IconButton
        name="times"
        size="lg"
        disabled={disabled}
        tooltip={t('grafana-ui.tags-input.remove', 'Remove tag: {{name}}', { name })}
        onClick={() => onRemove(name)}
        className={styles.buttonStyles}
      />
    </li>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  const height = theme.spacing.gridSize * 3;

  return {
    itemStyle: css({
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
      color: '#fff',
    }),
    defaultTagColor: css({
      backgroundColor: theme.colors.background.secondary,
      borderColor: theme.components.input.borderColor,
      color: theme.colors.text.primary,
    }),
    nameStyle: css({
      maxWidth: '25ch',
      textOverflow: 'ellipsis',
      overflow: 'hidden',
    }),
    buttonStyles: css({
      margin: 0,
      '&:hover::before': {
        display: 'none',
      },
    }),
  };
};
