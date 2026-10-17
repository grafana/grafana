import { type ReactNode } from 'react';

import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { IconButton } from '../IconButton/IconButton';

import { getStyles } from './styles';
import { type TilingTabRenderProps } from './types';

export interface TilingTabProps extends TilingTabRenderProps {
  /** Rendered before the title, such as an icon. */
  prefix?: ReactNode;
  /** Rendered after the title, such as a badge or extra buttons. */
  suffix?: ReactNode;
  /** Replaces the title text. */
  children?: ReactNode;
}

/**
 * The default tab content. Use it from `renderTab` to keep the standard look while adding your own parts:
 *
 * ```tsx
 * renderTab={(props) => <TilingTab {...props} prefix={<Icon name="graph-bar" />} />}
 * ```
 *
 * Buttons and links inside a tab handle their own clicks and don't start a drag.
 */
export function TilingTab({ view, closable, onClose, prefix, suffix, children }: TilingTabProps) {
  const styles = useStyles2(getStyles);
  return (
    <>
      {prefix}
      <span className={styles.tabTitle}>{children ?? view.title}</span>
      {suffix}
      {closable && (
        <IconButton
          name="times"
          size="sm"
          className={styles.tabClose}
          aria-label={t('grafana-ui.tiling-layout.close-view', 'Close {{title}}', { title: view.title })}
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        />
      )}
    </>
  );
}
