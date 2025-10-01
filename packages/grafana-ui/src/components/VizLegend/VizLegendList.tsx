import { css, cx } from '@emotion/css';
import { useState, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { InlineList } from '../List/InlineList';
import { List } from '../List/List';

import { VizLegendListItem } from './VizLegendListItem';
import { VizLegendBaseProps, VizLegendItem } from './types';

export interface Props<T> extends VizLegendBaseProps<T> {}

/**
 * @internal
 */
export const VizLegendList = <T extends unknown>({
  items,
  itemRenderer,
  onLabelMouseOver,
  onLabelMouseOut,
  onLabelClick,
  onLegendClick,
  placement,
  className,
  readonly,
  shouldSparkJoy,
}: Props<T>) => {
  const styles = useStyles2(getStyles);
  const [isListHovered, setListHovered] = useState<boolean>(false);

  const onLegendListMouseOver = useCallback(() => {
    setListHovered(true);
  }, [setListHovered]);

  const onLegendListMouseOut = useCallback(() => {
    setListHovered(false);
  }, [setListHovered]);

  if (!itemRenderer) {
    /* eslint-disable-next-line react/display-name */
    itemRenderer = (item) => (
      <VizLegendListItem
        item={item}
        onLabelClick={onLabelClick}
        onLabelMouseOver={onLabelMouseOver}
        onLabelMouseOut={onLabelMouseOut}
        readonly={readonly}
      />
    );
  }

  const getItemKey = (item: VizLegendItem<T>) => `${item.getItemKey ? item.getItemKey() : item.label}`;

  const containerMouseEvents = {
    role: 'button',
    onMouseOver: onLegendListMouseOver,
    onMouseOut: onLegendListMouseOut,
    onClick: (event: React.MouseEvent<HTMLDivElement>) => {
      event.stopPropagation();
      onLegendClick && onLegendClick(event);
    },
  };

  const sparkJoyClassNames = shouldSparkJoy
    ? {
        [styles.editable]: !isListHovered,
        [styles.editableHovered]: isListHovered,
      }
    : undefined;

  switch (placement) {
    case 'right': {
      const renderItem = (item: VizLegendItem<T>, index: number) => {
        return <span className={styles.itemRight}>{itemRenderer!(item, index)}</span>;
      };

      return (
        <div
          className={cx(styles.rightWrapper, className, sparkJoyClassNames)}
          {...(shouldSparkJoy ? containerMouseEvents : {})}
        >
          <List items={items} renderItem={renderItem} getItemKey={getItemKey} />
        </div>
      );
    }
    case 'bottom':
    default: {
      const leftItems = items.filter((item) => item.yAxis === 1);
      const rightItems = items.filter((item) => item.yAxis !== 1);

      const renderItem = (item: VizLegendItem<T>, index: number) => {
        return <span className={styles.itemBottom}>{itemRenderer!(item, index)}</span>;
      };

      return (
        <div
          className={cx(styles.bottomWrapper, className, sparkJoyClassNames)}
          {...(shouldSparkJoy ? containerMouseEvents : {})}
        >
          {leftItems.length > 0 && (
            <div className={styles.section}>
              <InlineList items={leftItems} renderItem={renderItem} getItemKey={getItemKey} />
            </div>
          )}
          {rightItems.length > 0 && (
            <div className={cx(styles.section, styles.sectionRight)}>
              <InlineList items={rightItems} renderItem={renderItem} getItemKey={getItemKey} />
            </div>
          )}
        </div>
      );
    }
  }
};

VizLegendList.displayName = 'VizLegendList';

const getStyles = (theme: GrafanaTheme2) => {
  const itemStyles = css({
    paddingRight: '10px',
    display: 'flex',
    fontSize: theme.typography.bodySmall.fontSize,
    whiteSpace: 'nowrap',
  });

  const unstyledButton = css({
    background: 'none',
    border: 'none',
    borderRadius: 'initial',
  });

  const editable = cx(
    unstyledButton,
    css({
      outline: '2px solid transparent',
      borderRadius: theme.shape.radius.default,
      outlineOffset: '-2px',
      [theme.transitions.handleMotion('no-preference')]: {
        transitionTimingFunction: 'ease-in',
        transitionDuration: '0.2s',
        transitionProperty: 'outline',
      },
    })
  );

  return {
    itemBottom: itemStyles,
    itemRight: cx(
      itemStyles,
      css({
        marginBottom: theme.spacing(0.5),
      })
    ),
    rightWrapper: css({
      padding: theme.spacing(0.5),
    }),
    bottomWrapper: css({
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      width: '100%',
      padding: theme.spacing(0.5),
      gap: '15px 25px',
    }),
    section: css({
      display: 'flex',
    }),
    sectionRight: css({
      justifyContent: 'flex-end',
      flexGrow: 1,
      flexBasis: '50%',
    }),
    editable,
    editableHovered: cx(
      editable,
      css({
        outline: '2px solid #6e9fff',
      })
    ),
  };
};
