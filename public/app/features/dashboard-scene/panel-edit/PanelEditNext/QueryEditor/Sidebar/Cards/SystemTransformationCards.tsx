import { css } from '@emotion/css';

import {
  type CustomTransformOperator,
  type DataTransformerConfig,
  type GrafanaTheme2,
  colorManipulator,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { type SystemTransformationPosition } from '@grafana/scenes';
import { Icon, useStyles2 } from '@grafana/ui';

import {
  getSystemTransformationName,
  getSystemTransformationTooltip,
  getSystemTransformationsGroupLabel,
} from '../../../../systemTransformationDisplay';
import { QueryEditorType, SIDEBAR_CARD_HEIGHT, SIDEBAR_CARD_INDENT, SIDEBAR_CARD_SPACING } from '../../../constants';
import { useQueryEditorTypeConfig } from '../../QueryEditorContext';

interface SystemTransformationCardsProps {
  transformations: Array<DataTransformerConfig | CustomTransformOperator>;
  position: SystemTransformationPosition;
}

/**
 * Deliberately not built on `SidebarCard`: that card is selectable, draggable and carries hover
 * actions, none of which apply — there is no editor to open, nothing to reorder, nothing to delete.
 */
export function SystemTransformationCards({ transformations, position }: SystemTransformationCardsProps) {
  const styles = useStyles2(getStyles);
  const typeConfig = useQueryEditorTypeConfig();

  if (transformations.length === 0) {
    return null;
  }

  return (
    <ul className={styles.list} aria-label={getSystemTransformationsGroupLabel(position)}>
      {transformations.map((transformation, index) => {
        const id = typeof transformation === 'function' ? undefined : transformation.id;

        return (
          <li
            key={`${id ?? 'custom'}-${index}`}
            className={styles.card}
            data-testid={selectors.components.Transforms.systemTransformationRow}
          >
            <Icon name={typeConfig[QueryEditorType.Transformation].icon} size="sm" />
            <span className={styles.title}>{getSystemTransformationName(transformation)}</span>
            {/* Titled, not decorative: there is no room for a badge here, so the icon carries it. */}
            <Icon name="lock" size="sm" title={getSystemTransformationTooltip()} />
          </li>
        );
      })}
    </ul>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    list: css({
      listStyle: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(SIDEBAR_CARD_SPACING),
      margin: theme.spacing(0, SIDEBAR_CARD_INDENT, SIDEBAR_CARD_SPACING, SIDEBAR_CARD_INDENT),
      padding: 0,
    }),
    card: css({
      minHeight: SIDEBAR_CARD_HEIGHT,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(0, 1),
      // Muted against the editable cards: signals "not yours to change" before the lock icon is read.
      background: colorManipulator.alpha(theme.colors.background.secondary, 0.5),
      border: `1px dashed ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.secondary,
    }),
    title: css({
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      ...theme.typography.body,
      fontWeight: theme.typography.fontWeightLight,
    }),
  };
}
