import { css } from '@emotion/css';
import React from 'react';

import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip';

import { TitleItem } from './TitleItem';

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
      <TitleItem className={styles.description}>
        <Icon name="info-circle" size="lg" title="description" />
      </TitleItem>
    </Tooltip>
  ) : null;
}

const getStyles = () => {
  return {
    description: css({
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
