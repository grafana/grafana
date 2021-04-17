import React, { FC, ReactNode, useCallback, useEffect, useState } from 'react';
import { css, cx } from '@emotion/css';
import _ from 'lodash';
import { GrafanaTheme } from '@grafana/data';
import { Counter, Icon, useStyles } from '@grafana/ui';
import { PANEL_EDITOR_UI_STATE_STORAGE_KEY } from './state/reducers';
import { useLocalStorage } from 'react-use';
import { selectors } from '@grafana/e2e-selectors';

export interface OptionsPaneCategoryProps {
  id: string;
  title?: string;
  renderTitle?: (isExpanded: boolean) => React.ReactNode;
  isOpenDefault?: boolean;
  itemsCount?: number;
  forceOpen?: number;
  className?: string;
  isNested?: boolean;
  children: ReactNode;
}

export const OptionsPaneCategory: FC<OptionsPaneCategoryProps> = React.memo(
  ({ id, title, children, forceOpen, isOpenDefault, renderTitle, className, itemsCount, isNested = false }) => {
    const [savedState, setSavedState] = useLocalStorage(getOptionGroupStorageKey(id), {
      isExpanded: isOpenDefault !== false,
    });
    const [isExpanded, setIsExpanded] = useState(savedState.isExpanded);
    const styles = useStyles(getStyles);

    useEffect(() => {
      if (!isExpanded && forceOpen && forceOpen > 0) {
        setIsExpanded(true);
      }
    }, [forceOpen, isExpanded]);

    const onToggle = useCallback(() => {
      setSavedState({ isExpanded: !isExpanded });
      setIsExpanded(!isExpanded);
    }, [setSavedState, setIsExpanded, isExpanded]);

    if (!renderTitle) {
      renderTitle = function defaultTitle(isExpanded: boolean) {
        if (isExpanded || itemsCount === undefined || itemsCount === 0) {
          return title;
        }

        return (
          <span>
            {title} <Counter value={itemsCount} />
          </span>
        );
      };
    }

    const boxStyles = cx(
      {
        [styles.box]: true,
        [styles.boxExpanded]: isExpanded,
        [styles.boxNestedExpanded]: isNested && isExpanded,
      },
      className,
      'options-group'
    );

    const headerStyles = cx(styles.header, {
      [styles.headerExpanded]: isExpanded,
      [styles.headerNested]: isNested,
    });

    const bodyStyles = cx(styles.body, {
      [styles.bodyNested]: isNested,
    });

    return (
      <div className={boxStyles} data-testid="options-category">
        <div className={headerStyles} onClick={onToggle} aria-label={selectors.components.OptionsGroup.toggle(id)}>
          <div className={cx(styles.toggle, 'editor-options-group-toggle')}>
            <Icon name={isExpanded ? 'angle-down' : 'angle-right'} />
          </div>
          <div className={styles.title} role="heading">
            {renderTitle(isExpanded)}
          </div>
        </div>
        {isExpanded && <div className={bodyStyles}>{children}</div>}
      </div>
    );
  }
);

const getStyles = (theme: GrafanaTheme) => {
  return {
    box: css`
      border-bottom: 1px solid ${theme.v2.palette.border.weak};
      &:last-child {
        border-bottom: none;
      }
    `,
    boxExpanded: css`
      border-bottom: 0;
    `,
    boxNestedExpanded: css`
      margin-bottom: ${theme.spacing.formSpacingBase * 2}px;
    `,
    toggle: css`
      color: ${theme.v2.palette.text.secondary};
      margin-right: ${theme.spacing.sm};
    `,
    title: css`
      flex-grow: 1;
      overflow: hidden;
    `,
    header: css`
      display: flex;
      cursor: pointer;
      align-items: baseline;
      padding: ${theme.v2.spacing(1)};
      color: ${theme.v2.palette.text.primary};
      font-weight: ${theme.v2.typography.fontWeightMedium};

      &:hover {
        background: ${theme.v2.palette.emphasize(theme.v2.palette.background.primary, 0.03)};
      }
    `,
    headerExpanded: css`
      color: ${theme.v2.palette.text.primary};
    `,
    headerNested: css`
      padding: ${theme.v2.spacing(0.5, 0, 0.5, 0)};
    `,
    body: css`
      padding: ${theme.v2.spacing(1, 2, 1, 4)};
    `,
    bodyNested: css`
      position: relative;
      padding-right: 0;
      &:before {
        content: '';
        position: absolute;
        top: 0;
        left: 8px;
        width: 1px;
        height: 100%;
        background: ${theme.v2.palette.border.weak};
      }
    `,
  };
};

const getOptionGroupStorageKey = (id: string): string => `${PANEL_EDITOR_UI_STATE_STORAGE_KEY}.optionGroup[${id}]`;
