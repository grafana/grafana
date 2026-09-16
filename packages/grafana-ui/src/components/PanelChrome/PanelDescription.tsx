import { css, cx } from '@emotion/css';
import type { JSX } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { useStyles2 } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';
import { Text } from '../Text/Text';
import { Tooltip } from '../Tooltip/Tooltip';

import { TitleItem } from './TitleItem';

interface Props {
  description: string | (() => string);
  className?: string;
  inSubHeader?: boolean;
}

export function PanelDescription({ description, className, inSubHeader }: Props) {
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

  if (inSubHeader) {
    return (
      <Text variant="bodySmall" color="secondary" data-testid={selectors.components.Panels.Panel.subtitle}>
        {getDescriptionContent()}
      </Text>
    );
  }

  return description !== '' ? (
    <Tooltip interactive content={getDescriptionContent}>
      <TitleItem className={cx(className, styles.description)}>
        <Icon name="info-circle" size="md" />
      </TitleItem>
    </Tooltip>
  ) : null;
}

const getStyles = (theme: GrafanaTheme2) => {
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
