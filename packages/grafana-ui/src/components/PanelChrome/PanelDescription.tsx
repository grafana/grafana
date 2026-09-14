import { css, cx } from '@emotion/css';
import type { JSX } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';
import { Text } from '../Text/Text';
import { Tooltip } from '../Tooltip/Tooltip';

import { TitleItem } from './TitleItem';

interface Props {
  description: string | (() => string);
  className?: string;
  inSubHeader?: boolean;
  /** Panel title used for the accessible name of the info control */
  title?: string;
}

export function PanelDescription({ description, className, inSubHeader, title }: Props) {
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
      <Text variant="bodySmall" color="secondary">
        {getDescriptionContent()}
      </Text>
    );
  }

  const ariaLabel = title
    ? t('grafana-ui.panel-chrome.aria-label-panel-description', 'More information about {{title}}', { title })
    : t('grafana-ui.panel-chrome.aria-label-panel-description-fallback', 'More information');

  return description !== '' ? (
    <Tooltip interactive content={getDescriptionContent}>
      {/*
        Tooltip must wrap the triggering element so it can set aria-describedby.
        TitleItem with onClick renders a real button (accessible name + role).
      */}
      <TitleItem
        className={cx(className, styles.description)}
        aria-label={ariaLabel}
        onClick={() => {
          // No-op: opens via Tooltip focus/hover; onClick makes TitleItem a button.
        }}
      >
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
