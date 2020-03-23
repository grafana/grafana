import React, { FC } from 'react';
import { cx, css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useTheme } from '../../themes';
import { getTagColorsFromName } from '../../utils';

interface TagProps {
  name: string;
  onClick?: any;
}

export const Tag: FC<TagProps> = ({ name, onClick, ...rest }) => {
  const theme = useTheme();
  const styles = getTagStyles(theme, name);

  const onTagClick = () => {
    onClick(name);
  };

  return (
    <span key={name} onClick={onTagClick} className={styles.wrapper} {...rest}>
      {name}
    </span>
  );
};

const getTagStyles = (theme: GrafanaTheme, name: string) => {
  const { borderColor, color } = getTagColorsFromName(name);
  return {
    wrapper: cx(
      css`
        font-weight: ${theme.typography.weight.semibold};
        font-size: ${theme.typography.size.base};
        line-height: ${theme.typography.lineHeight.xs};
        vertical-align: baseline;
        background-color: ${color};
        color: ${theme.colors.white};
        white-space: nowrap;
        text-shadow: none;
        padding: 2px 6px;
        border: 1px solid ${borderColor};
        border-radius: ${theme.border.radius.md};
      `
    ),
  };
};
