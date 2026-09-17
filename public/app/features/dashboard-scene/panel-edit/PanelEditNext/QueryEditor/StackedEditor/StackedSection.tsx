import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { getQueryEditorTypeConfig, QueryEditorType } from '../../constants';
import { type StackedEditorItem } from '../QueryEditorContext';
import { getHiddenMaskStyles } from '../utils';

import { StackedQueryItem, StackedTransformationItem } from './StackedItem';
import { isStackedItemHidden, type StackedItem } from './utils';

interface StackedSectionProps {
  item: StackedItem;
  isCurrent: boolean;
  headingId: string;
}

export function StackedSection({ item, isCurrent, headingId }: StackedSectionProps) {
  const styles = useStyles2(getStyles);
  const activeStyle = isCurrent ? styles.activeItemStyleByType[item.type] : undefined;
  const isHidden = isStackedItemHidden(item);

  return (
    <section
      className={cx(styles.item, activeStyle, { [styles.hiddenAccentBar]: isHidden })}
      aria-current={isCurrent ? 'true' : undefined}
      aria-labelledby={headingId}
      data-stacked-editor-item-id={item.id}
      data-stacked-editor-item-type={item.type}
    >
      {item.type === QueryEditorType.Transformation ? (
        <StackedTransformationItem transformation={item.transformation} headingId={headingId} />
      ) : (
        <StackedQueryItem query={item.query} headingId={headingId} />
      )}
    </section>
  );
}

const getActiveAccentBar = (color: string) => css({ '&::before': { background: color } });

const getStyles = (theme: GrafanaTheme2) => {
  // Pull active-item accent colors from the shared type config so the stacked list stays in sync
  // with single-edit headers if those colors ever change.
  const typeConfig = getQueryEditorTypeConfig(theme);
  const activeItemStyleByType = {
    [QueryEditorType.Query]: getActiveAccentBar(typeConfig[QueryEditorType.Query].color),
    [QueryEditorType.Expression]: getActiveAccentBar(typeConfig[QueryEditorType.Expression].color),
    [QueryEditorType.Transformation]: getActiveAccentBar(typeConfig[QueryEditorType.Transformation].color),
  } satisfies Record<StackedEditorItem['type'], string>;

  return {
    item: css({
      position: 'relative',
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.primary,
      overflow: 'hidden',
      marginBottom: theme.spacing(1.5),
      // Matches ContentHeader's 4px accent bar width so single-edit and stacked headers align.
      '&::before': {
        content: '""',
        position: 'absolute',
        bottom: 0,
        left: 0,
        top: 0,
        width: 4,
        zIndex: 1,
      },
    }),
    activeItemStyleByType,
    hiddenAccentBar: css({
      '&::before': getHiddenMaskStyles(theme),
    }),
  };
};
