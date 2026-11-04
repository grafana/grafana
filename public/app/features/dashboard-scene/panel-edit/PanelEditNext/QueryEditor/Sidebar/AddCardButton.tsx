import { css, cx } from '@emotion/css';
import { useCallback, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Dropdown, Icon, useStyles2, useTheme2 } from '@grafana/ui';

import { trackAddTransformationInitiated } from '../../tracking';
import { AddCardMenu } from '../AddCardMenu';
import { useQueryEditorUIContext } from '../QueryEditorContext';

function getButtonAriaLabel(variant: 'query' | 'transformation', afterId?: string) {
  if (variant === 'transformation') {
    return afterId
      ? t('query-editor-next.sidebar.add-transformation-below', 'Add transformation below {{id}}', { id: afterId })
      : t('query-editor-next.sidebar.add-transformation', 'Add transformation');
  }

  return afterId
    ? t('query-editor-next.sidebar.add-below', 'Add below {{id}}', { id: afterId })
    : t('query-editor-next.sidebar.add-query-or-expression', 'Add query or expression');
}

interface AddCardButtonProps {
  variant: 'query' | 'transformation';
  afterId?: string;
  alwaysVisible?: boolean;
  showLabel?: boolean;
  onAdd?: () => void;
}

export const AddCardButton = ({
  variant,
  afterId,
  onAdd,
  alwaysVisible = false,
  showLabel = false,
}: AddCardButtonProps) => {
  const showButtonLabel = alwaysVisible && showLabel;
  const styles = useStyles2(getStyles, alwaysVisible);
  const theme = useTheme2();
  const { setPendingTransformation } = useQueryEditorUIContext();

  const [menuOpen, setMenuOpen] = useState(false);

  const handleMenuVisibleChange = useCallback((visible: boolean) => {
    setMenuOpen(visible);
  }, []);

  const queryMenu = <AddCardMenu afterId={afterId} source={afterId ? 'inline' : 'section_header'} onAdd={onAdd} />;

  const handleTransformationClick = useCallback(() => {
    trackAddTransformationInitiated(afterId ? 'inline' : 'section_header');
    setPendingTransformation({ insertAfter: afterId });
    onAdd?.();
  }, [afterId, setPendingTransformation, onAdd]);

  const ariaLabel = getButtonAriaLabel(variant, afterId);
  const buttonLabel = t('query-editor-next.sidebar.add', 'Add');

  if (variant === 'transformation') {
    return (
      <button
        className={cx(styles.button, { [styles.buttonWithLabel]: showButtonLabel })}
        data-add-button={!alwaysVisible || undefined}
        data-testid={
          afterId
            ? selectors.components.Transforms.addTransformationBelowButton(afterId)
            : selectors.components.Transforms.addTransformationButton
        }
        type="button"
        aria-label={ariaLabel}
        onClick={handleTransformationClick}
      >
        <Icon name="plus" size={alwaysVisible ? 'sm' : 'md'} />
        {showButtonLabel && buttonLabel}
      </button>
    );
  }

  return (
    <Dropdown
      overlay={queryMenu}
      placement={alwaysVisible ? 'bottom-start' : 'right-start'}
      offset={alwaysVisible ? [0, theme.spacing.gridSize * 0.5] : [theme.spacing.gridSize, 0]}
      onVisibleChange={handleMenuVisibleChange}
    >
      <button
        className={cx(styles.button, { [styles.buttonWithLabel]: showButtonLabel })}
        data-add-button={!alwaysVisible || undefined}
        data-menu-open={menuOpen || undefined}
        type="button"
        aria-label={ariaLabel}
      >
        <Icon name="plus" size={alwaysVisible ? 'sm' : 'md'} />
        {showButtonLabel && buttonLabel}
      </button>
    </Dropdown>
  );
};

function getStyles(theme: GrafanaTheme2, alwaysVisible: boolean) {
  return {
    button: css({
      display: alwaysVisible ? 'inline-flex' : 'flex',
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
      // Never let the row's flex layout shrink this below its own content — the section title
      // wraps to make room instead.
      flexShrink: 0,
      willChange: 'transform',
      transform: alwaysVisible ? 'translateZ(0)' : 'translateY(-50%) translateZ(0)',

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: [
          theme.transitions.create(alwaysVisible ? ['background-color'] : ['opacity', 'background-color'], {
            duration: 100,
          }),
          'transform 250ms cubic-bezier(0.25, 1, 0.5, 1)',
        ].join(', '),
      },

      // Hover-button positioning & hidden-by-default state (revealed by SidebarCard hover)
      ...(!alwaysVisible && {
        position: 'absolute' as const,
        top: `calc(100% + ${theme.spacing(0.25)})`,
        left: theme.spacing(-2.5),
        zIndex: 1,
        opacity: 0,
        pointerEvents: 'none' as const,
      }),

      '&:hover': {
        background: theme.colors.secondary.shade,
      },

      '&:active': {
        transform: alwaysVisible ? 'scale(0.97)' : 'translateY(-50%) scale(0.97)',
      },

      '&:focus-visible': {
        // Intentionally not theme.colors.secondary.border — that token is a faint decorative
        // border for the solid fill and is nearly invisible as a focus ring against it.
        outline: `2px solid ${theme.colors.primary.border}`,
        outlineOffset: '2px',
        ...(!alwaysVisible && {
          opacity: 1,
          pointerEvents: 'auto' as const,
        }),
      },
    }),
    buttonWithLabel: css({
      width: 'auto',
      gap: theme.spacing(0.5),
      padding: theme.spacing(0, 0.75),
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      marginLeft: 'auto',
    }),
  };
}
