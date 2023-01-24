import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { getFocusStyles, getMouseFocusStyles } from '../../themes/mixins';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip';

import { TitleItem } from './TitleItem';

interface Props {
  description: string | (() => string);
  className?: string;
}

export function PanelDescription({ description, className }: Props) {
  const styles = useStyles2(getStyles);

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
      <TitleItem className={cx(className, styles.description)}>
        <Icon name="info-circle" size="lg" title="description" />
      </TitleItem>
    </Tooltip>
  ) : null;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    description: css({
      color: `${theme.colors.text.secondary}`,
      backgroundColor: 'inherit',
      cursor: 'auto',
      border: 'none',
      borderRadius: `${theme.shape.borderRadius()}`,
      padding: `${theme.spacing(0, 1)}`,
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',

      '&:focus, &:focus-visible': {
        ...getFocusStyles(theme),
        zIndex: 1,
      },
      '&: focus:not(:focus-visible)': getMouseFocusStyles(theme),

      '&:hover ': {
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
