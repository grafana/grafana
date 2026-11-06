import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Dropdown, Icon, Menu, useStyles2, useTheme2 } from '@grafana/ui';

import { QueryEditorType } from '../../constants';
import { useQueryEditorTypeConfig, useQueryEditorUIContext } from '../QueryEditorContext';
import { AddQueryMenuItems } from '../Sidebar/AddQueryMenuItems';
import { useAddTransformation } from '../Sidebar/useAddCardActions';

interface StackedAddBarProps {
  variant: 'query' | 'transformation';
  /** refId for query bars, transformId for transformation bars. */
  afterId: string;
}

export function StackedAddBar({ variant, afterId }: StackedAddBarProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const typeConfig = useQueryEditorTypeConfig();
  const { multiSelectMode } = useQueryEditorUIContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const addTransformationAfter = useAddTransformation(afterId, undefined, 'stacked_gap');
  // Transformations run after all queries, so a query gap can only append to the end.
  const appendTransformation = useAddTransformation(undefined, undefined, 'stacked_gap');

  if (multiSelectMode) {
    return <div className={styles.spacer} data-stacked-add-spacer />;
  }

  const line = <div className={styles.line} />;

  if (variant === 'transformation') {
    return (
      <div className={styles.bar} data-stacked-add-bar>
        {line}
        <button
          type="button"
          className={styles.button}
          aria-label={t('query-editor-next.sidebar.add-transformation-below', 'Add transformation below {{id}}', {
            id: afterId,
          })}
          onClick={addTransformationAfter}
        >
          <Icon name="plus" size="sm" />
          {t('query-editor-next.sidebar.add-transformation', 'Add transformation')}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.bar} data-stacked-add-bar data-open={menuOpen || undefined}>
      {line}
      <Dropdown
        overlay={
          <Menu>
            <AddQueryMenuItems afterId={afterId} source="stacked_gap" />
            <Menu.Divider />
            <Menu.Item
              label={t('query-editor-next.sidebar.add-transformation', 'Add transformation')}
              icon={typeConfig[QueryEditorType.Transformation].icon}
              onClick={appendTransformation}
            />
          </Menu>
        }
        placement="bottom-start"
        offset={[0, theme.spacing.gridSize * 0.5]}
        onVisibleChange={setMenuOpen}
      >
        <button
          type="button"
          className={styles.button}
          aria-label={t('query-editor-next.sidebar.add-below', 'Add below {{id}}', { id: afterId })}
        >
          <Icon name="plus" size="sm" />
          {t('query-editor-next.sidebar.add', 'Add')}
        </button>
      </Dropdown>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const transition = {
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create(['height', 'opacity', 'background-color', 'color'], { duration: 150 }),
    },
  };

  return {
    spacer: css({
      height: theme.spacing(1.5),
    }),
    bar: css({
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      height: theme.spacing(1.5),
      paddingLeft: theme.spacing(2),
      // Keeps the collapsed 24px button from widening the 12px hover zone into the neighbouring cards.
      overflow: 'hidden',
      ...transition,

      // :focus-visible rather than :focus-within, so a mouse click doesn't keep the bar open once
      // the pointer leaves (the button keeps focus after the click).
      '&:hover, &:has(:focus-visible), &[data-open]': {
        height: theme.spacing(4),
      },
      '&:hover > *, &:has(:focus-visible) > *, &[data-open] > *': {
        opacity: 1,
      },
    }),
    line: css({
      position: 'absolute',
      left: 0,
      right: 0,
      top: '50%',
      height: 1,
      background: theme.colors.border.medium,
      opacity: 0,
      ...transition,
    }),
    button: css({
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      flexShrink: 0,
      gap: theme.spacing(0.5),
      height: theme.spacing(3),
      padding: theme.spacing(0, 1),
      border: `1px dashed ${theme.colors.border.strong}`,
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.primary,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      cursor: 'pointer',
      opacity: 0,
      ...transition,

      '&:hover': {
        background: theme.colors.background.secondary,
        color: theme.colors.text.primary,
      },
      '&:focus-visible': {
        outline: `2px solid ${theme.colors.primary.border}`,
        outlineOffset: '2px',
      },
    }),
  };
};
