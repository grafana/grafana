import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { getTagColorsFromName } from '../../utils';
import { IconButton } from '../IconButton/IconButton';

interface Props {
  name: string;
  disabled?: boolean;
  onRemove: (tag: string) => void;
}

/**
 * @internal
 * Only used internally by TagsInput
 * */
export const TagItem = ({ name, disabled, onRemove }: Props) => {
  const { color, borderColor } = useMemo(() => getTagColorsFromName(name), [name]);
  const styles = useStyles2(getStyles);

  return (
    <li className={styles.itemStyle} style={{ backgroundColor: color, borderColor }}>
      <span className={styles.nameStyle}>{name}</span>
      <IconButton
        name="times"
        size="lg"
        disabled={disabled}
        ariaLabel={`Remove "${name}" tag`}
        onClick={() => onRemove(name)}
        type="button"
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
