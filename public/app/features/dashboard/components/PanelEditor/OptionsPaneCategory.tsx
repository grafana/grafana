import { css, cx } from '@emotion/css';
import { ReactNode, useCallback, useEffect, useState, useRef } from 'react';
import * as React from 'react';
import { useLocalStorage } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Button, Counter, Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { PANEL_EDITOR_UI_STATE_STORAGE_KEY } from './state/reducers';

export interface OptionsPaneCategoryProps {
  id: string;
  title?: string;
  renderTitle?: (isExpanded: boolean) => React.ReactNode;
  isOpenDefault?: boolean;
  itemsCount?: number;
  forceOpen?: boolean;
  className?: string;
  isNested?: boolean;
  children: ReactNode;
  sandboxId?: string;
  /**
   * When set will disable category and show tooltip with disabledText on hover
   */
  disabledText?: string;
}

const CATEGORY_PARAM_NAME = 'showCategory' as const;

export const OptionsPaneCategory = React.memo(
  ({
    id,
    title,
    children,
    forceOpen,
    isOpenDefault = true,
    renderTitle,
    className,
    itemsCount,
    isNested = false,
    sandboxId,
    disabledText,
  }: OptionsPaneCategoryProps) => {
    const [savedState, setSavedState] = useLocalStorage(getOptionGroupStorageKey(id), {
      isExpanded: isOpenDefault,
    });

    const isExpandedInitialValue = forceOpen || (savedState?.isExpanded ?? isOpenDefault);
    const [isExpanded, setIsExpanded] = useState(isExpandedInitialValue);
    const ref = useRef<HTMLDivElement>(null);
    const [queryParams, updateQueryParams] = useQueryParams();
    const isOpenFromUrl = queryParams[CATEGORY_PARAM_NAME] === id;

    // Handle opening by forceOpen param or from URL
    useEffect(() => {
      if ((forceOpen || isOpenFromUrl) && !isExpanded) {
        setIsExpanded(true);
        setTimeout(() => {
          ref.current?.scrollIntoView();
        }, 200);
      }
    }, [isExpanded, isOpenFromUrl, forceOpen]);

    const onToggle = useCallback(() => {
      updateQueryParams({ [CATEGORY_PARAM_NAME]: isExpanded ? undefined : id }, true);
      setSavedState({ isExpanded: !isExpanded });
      setIsExpanded(!isExpanded);
    }, [updateQueryParams, isExpanded, id, setSavedState]);

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

    const styles = useStyles2(getStyles);
    const boxStyles = cx(
      {
        [styles.box]: true,
        [styles.boxNestedExpanded]: isNested && isExpanded,
      },
      className
    );

    const headerStyles = cx(styles.header, {
      [styles.headerExpanded]: isExpanded,
      [styles.headerNested]: isNested,
    });

    const bodyStyles = cx(styles.body, {
      [styles.bodyNested]: isNested,
    });

    /**
     * Disabled categories just show the disabled header and icon
     */
    if (disabledText) {
      return (
        <div
          className={boxStyles}
          data-plugin-sandbox={sandboxId}
          data-testid={selectors.components.OptionsGroup.group(id)}
          ref={ref}
        >
          <Tooltip content={disabledText}>
            <div className={headerStyles}>
              <h6 id={`button-${id}`} className={cx(styles.title, styles.titleDisabled)}>
                {renderTitle(isExpanded)}
              </h6>
              <Icon size="sm" name="ban" className={styles.disabledIcon} />
            </div>
          </Tooltip>
        </div>
      );
    }

    return (
      <div
        className={boxStyles}
        data-plugin-sandbox={sandboxId}
        data-testid={selectors.components.OptionsGroup.group(id)}
        ref={ref}
      >
        {/* disabling a11y rules here because there's a Button that handles keyboard interaction */}
        {/* this just provides a better experience for mouse users */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div className={headerStyles} onClick={onToggle}>
          <h6 id={`button-${id}`} className={cx(styles.title, isExpanded && styles.titleExpanded)}>
            {renderTitle(isExpanded)}
          </h6>
          <Button
            aria-label={
              isExpanded
                ? t('dashboard.options-pane-category.aria-label-collapse', 'Collapse {{title}} category', { title })
                : t('dashboard.options-pane-category.aria-label-expand', 'Expand {{title}} category', { title })
            }
            data-testid={selectors.components.OptionsGroup.toggle(id)}
            type="button"
            fill="text"
            size="md"
            variant="secondary"
            aria-expanded={isExpanded}
            className={styles.toggleButton}
            icon={isExpanded ? 'angle-up' : 'angle-down'}
            onClick={onToggle}
          />
        </div>
        {isExpanded && (
          <div className={bodyStyles} id={id} aria-labelledby={`button-${id}`}>
            {children}
          </div>
        )}
      </div>
    );
  }
);

const getStyles = (theme: GrafanaTheme2) => ({
  box: css({
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
  boxNestedExpanded: css({
    marginBottom: theme.spacing(2),
  }),
  title: css({
    flexGrow: 1,
    overflow: 'hidden',
    lineHeight: 1.5,
    fontSize: '1rem',
    fontWeight: theme.typography.fontWeightMedium,
    margin: 0,
    color: theme.colors.text.secondary,
  }),
  titleExpanded: css({
    color: theme.colors.text.primary,
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0.5, 1.5),
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeightMedium,
    cursor: 'pointer',
    '&:hover': {
      background: theme.colors.emphasize(theme.colors.background.primary, 0.03),
    },
  }),
  toggleButton: css({
    alignSelf: 'baseline',
  }),
  headerExpanded: css({
    color: theme.colors.text.primary,
  }),
  headerNested: css({
    padding: theme.spacing(0.5, 0, 0.5, 0),
  }),
  body: css({
    padding: theme.spacing(1, 2, 1, 2),
  }),
  titleDisabled: css({
    color: theme.colors.text.disabled,
    cursor: 'not-allowed',
  }),
  disabledIcon: css({
    color: theme.colors.text.disabled,
    marginRight: theme.spacing(1),
  }),
  bodyNested: css({
    position: 'relative',
    paddingRight: 0,

    '&:before': {
      content: "''",
      position: 'absolute',
      top: 0,
      left: '1px',
      width: '1px',
      height: '100%',
      background: theme.colors.border.weak,
    },
  }),
});

const getOptionGroupStorageKey = (id: string) => `${PANEL_EDITOR_UI_STATE_STORAGE_KEY}.optionGroup[${id}]`;
