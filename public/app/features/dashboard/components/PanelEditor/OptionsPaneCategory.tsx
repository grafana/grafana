import React, { FC, ReactNode, useCallback, useEffect, useState } from 'react';
import { css, cx } from 'emotion';
import _ from 'lodash';
import { GrafanaTheme } from '@grafana/data';
import { Counter, Icon, stylesFactory, useTheme } from '@grafana/ui';
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
    const theme = useTheme();
    const styles = getStyles(theme, isExpanded, isNested);

    useEffect(() => {
      if (!isExpanded && forceOpen && forceOpen > 0) {
        setIsExpanded(true);
      }
    }, [forceOpen]);

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

    return (
      <div className={cx(styles.box, className, 'options-group')} data-testid="options-category">
        <div className={styles.header} onClick={onToggle} aria-label={selectors.components.OptionsGroup.toggle(id)}>
          <div className={cx(styles.toggle, 'editor-options-group-toggle')}>
            <Icon name={isExpanded ? 'angle-down' : 'angle-right'} />
          </div>
          <div className={styles.title} role="heading">
            {renderTitle(isExpanded)}
          </div>
        </div>
        {isExpanded && <div className={styles.body}>{children}</div>}
      </div>
    );
  }
);

const getStyles = stylesFactory((theme: GrafanaTheme, isExpanded: boolean, isNested: boolean) => {
  return {
    box: cx(
      !isNested &&
        css`
          border-bottom: 1px solid ${theme.colors.pageHeaderBorder};
          &:last-child {
            border-bottom: none;
          }
        `,
      isNested &&
        isExpanded &&
        css`
          margin-bottom: ${theme.spacing.formSpacingBase * 2}px;
        `
    ),
    toggle: css`
      color: ${theme.colors.textWeak};
      margin-right: ${theme.spacing.sm};
    `,
    title: css`
      flex-grow: 1;
      overflow: hidden;
    `,
    header: cx(
      css`
        display: flex;
        cursor: pointer;
        align-items: baseline;
        padding: ${theme.spacing.sm};
        color: ${isExpanded ? theme.colors.text : theme.colors.formLabel};
        font-weight: ${theme.typography.weight.semibold};

        &:hover {
          color: ${theme.colors.text};

          .editor-options-group-toggle {
            color: ${theme.colors.text};
          }
        }
      `,
      isNested &&
        css`
          padding-left: 0;
          padding-right: 0;
          padding-top: 0;
        `
    ),
    body: cx(
      css`
        padding: ${theme.spacing.sm} ${theme.spacing.md} ${theme.spacing.sm} ${theme.spacing.xl};
      `,
      isNested &&
        css`
          position: relative;
          padding-right: 0;
          &:before {
            content: '';
            position: absolute;
            top: 0;
            left: 8px;
            width: 1px;
            height: 100%;
            background: ${theme.colors.pageHeaderBorder};
          }
        `
    ),
  };
});

const getOptionGroupStorageKey = (id: string): string => `${PANEL_EDITOR_UI_STATE_STORAGE_KEY}.optionGroup[${id}]`;
