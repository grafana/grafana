import { css } from '@emotion/css';
import React from 'react';

import { ToolbarButton } from '../ToolbarButton';
import { Tooltip } from '../Tooltip';

interface Props {
  description: string | (() => string);
}

export function PanelDescription({ description }: Props) {
  const styles = getStyles();

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
      <ToolbarButton icon="info-circle" className={styles.description} />
    </Tooltip>
  ) : null;
}

const getStyles = () => {
  return {
    description: css({
      cursor: 'pointer',
      border: 'none',

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
