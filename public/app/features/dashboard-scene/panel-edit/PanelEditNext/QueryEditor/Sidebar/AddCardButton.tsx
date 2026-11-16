import { css } from '@emotion/css';
import { useCallback, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Dropdown, Icon, Menu, useStyles2, useTheme2 } from '@grafana/ui';

import { AddQueryMenuItems } from './AddQueryMenuItems';
import { useAddTransformation } from './useAddCardActions';

interface AddCardButtonProps {
  variant: 'query' | 'transformation';
  afterId: string;
}

export const AddCardButton = ({ variant, afterId }: AddCardButtonProps) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const handleTransformationClick = useAddTransformation(afterId);

  const [menuOpen, setMenuOpen] = useState(false);

  const handleMenuVisibleChange = useCallback((visible: boolean) => {
    setMenuOpen(visible);
  }, []);

  if (variant === 'transformation') {
    return (
      <button
        className={styles.button}
        data-add-button
        data-testid={selectors.components.Transforms.addTransformationBelowButton(afterId)}
        type="button"
        aria-label={t('query-editor-next.sidebar.add-transformation-below', 'Add transformation below {{id}}', {
          id: afterId,
        })}
        onClick={handleTransformationClick}
      >
        <Icon name="plus" size="md" />
      </button>
    );
  }

  return (
    <Dropdown
      overlay={
        <Menu>
          <AddQueryMenuItems afterId={afterId} />
        </Menu>
      }
      placement="right-start"
      offset={[theme.spacing.gridSize, 0]}
      onVisibleChange={handleMenuVisibleChange}
    >
      <button
        className={styles.button}
        data-add-button
        data-menu-open={menuOpen || undefined}
        type="button"
        aria-label={t('query-editor-next.sidebar.add-below', 'Add below {{id}}', { id: afterId })}
      >
        <Icon name="plus" size="md" />
      </button>
    </Dropdown>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    button: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: theme.spacing(2.5),
      height: theme.spacing(2.5),
      borderRadius: theme.shape.radius.sm,
      border: 'none',
      background: theme.colors.secondary.main,
      color: theme.colors.secondary.contrastText,
      cursor: 'pointer',
      padding: 0,
      willChange: 'transform',
      transform: 'translateY(-50%) translateZ(0)',

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: [
          theme.transitions.create(['opacity', 'background-color'], {
            duration: 100,
          }),
          'transform 250ms cubic-bezier(0.25, 1, 0.5, 1)',
        ].join(', '),
      },

      // Hidden by default; revealed by SidebarCard hover.
      position: 'absolute',
      top: `calc(100% + ${theme.spacing(0.25)})`,
      left: theme.spacing(-2.5),
      zIndex: 1,
      opacity: 0,
      pointerEvents: 'none',

      '&:hover': {
        background: theme.colors.secondary.shade,
      },

      '&:active': {
        transform: 'translateY(-50%) scale(0.97)',
      },

      '&:focus-visible': {
        // Intentionally not theme.colors.secondary.border — that token is a faint decorative
        // border for the solid fill and is nearly invisible as a focus ring against it.
        outline: `2px solid ${theme.colors.primary.border}`,
        outlineOffset: '2px',
        opacity: 1,
        pointerEvents: 'auto',
      },
    }),
  };
}
