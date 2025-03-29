import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../themes';
import { getTagColorsFromName } from '../../utils';
import { t } from '../../utils/i18n';
import { IconButton } from '../IconButton/IconButton';

interface Props {
  name: string;
  disabled?: boolean;
  onRemove: (tag: string) => void;
  disableColoredTags?: boolean;
}

/**
 * @internal
 * Only used internally by TagsInput
 * */
export const TagItem = ({ name, disabled, onRemove, disableColoredTags }: Props) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  // Use theme colors or random colors based on name
  const tagStyle = useMemo(() => {
    if (disableColoredTags) {
      return {
        backgroundColor: theme.colors.background.secondary,
        borderColor: theme.components.input.borderColor,
        color: theme.colors.text.primary,
      };
    }

    const { color, borderColor } = getTagColorsFromName(name);
    return { backgroundColor: color, borderColor };
  }, [name, disableColoredTags, theme]);

  return (
    <li className={styles.itemStyle} style={tagStyle}>
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
      color: '#fff',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderRadius: theme.shape.radius.default,
      padding: `0 ${theme.spacing(0.5)}`,
      whiteSpace: 'nowrap',
      textShadow: 'none',
      fontWeight: 500,
      fontSize: theme.typography.size.sm,
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
