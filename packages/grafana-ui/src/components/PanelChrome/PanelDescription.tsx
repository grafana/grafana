import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useTheme2 } from '../../themes';
import { getFocusStyles, getMouseFocusStyles } from '../../themes/mixins';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip';

interface Props {
  description: string | (() => string);
  className?: string;
}

export function PanelDescription({ description, className }: Props) {
  const theme = useTheme2();
  const styles = getStyles(theme);

  const getDescriptionContent = (): JSX.Element => {
    // description
    const panelDescription = typeof description === 'function' ? description() : description;

    return (
      <div className="panel-info-content markdown-html">
        <div dangerouslySetInnerHTML={{ __html: panelDescription }} />
      </div>
    );
  };

  return description !== '' ? (
    <Tooltip interactive content={getDescriptionContent}>
      <span className={cx(className, styles.description)}>
        <Icon name="info-circle" size="lg" aria-label="description" />
      </span>
    </Tooltip>
  ) : null;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    description: css({
      color: `${theme.colors.text.secondary}`,
      backgroundColor: `${theme.colors.background.primary}`,
      cursor: 'auto',
      border: 'none',
      borderRadius: `${theme.shape.borderRadius()}`,
      padding: `${theme.spacing(0, 1)}`,
      height: ` ${theme.spacing(theme.components.height.md)}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',

      '&:focus, &:focus-visible': {
        ...getFocusStyles(theme),
        zIndex: 1,
      },
      '&: focus:not(:focus-visible)': getMouseFocusStyles(theme),

      '&:hover ': {
        boxShadow: `${theme.shadows.z1}`,
        color: `${theme.colors.text.primary}`,
        background: `${theme.colors.background.secondary}`,
      },

      code: {
        whiteSpace: 'normal',
        wordWrap: 'break-word',
      },

      'pre > code': {
        display: 'block',
      },
    }),
  };
};
