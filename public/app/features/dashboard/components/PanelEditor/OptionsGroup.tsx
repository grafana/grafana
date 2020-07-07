import React, { FC, memo, ReactNode, useCallback, useEffect, useState } from 'react';
import { css, cx } from 'emotion';
import _ from 'lodash';
import { GrafanaTheme } from '@grafana/data';
import { Icon, stylesFactory, useTheme } from '@grafana/ui';
import { PANEL_EDITOR_UI_STATE_STORAGE_KEY } from './state/reducers';
import { useLocalStorage } from 'react-use';
import { selectors } from '@grafana/e2e-selectors';

export interface OptionsGroupProps {
  id: string;
  title?: React.ReactNode;
  renderTitle?: (isExpanded: boolean) => React.ReactNode;
  defaultToClosed?: boolean;
  className?: string;
  nested?: boolean;
  persistMe?: boolean;
  onToggle?: (isExpanded: boolean) => void;
  children: ((toggleExpand: (expanded: boolean) => void) => ReactNode) | ReactNode;
}

export const OptionsGroup: FC<OptionsGroupProps> = ({
  id,
  title,
  children,
  defaultToClosed,
  renderTitle,
  className,
  nested = false,
  persistMe = true,
  onToggle,
}) => {
  if (persistMe) {
    return (
      <CollapsibleSectionWithPersistence
        id={id}
        defaultToClosed={defaultToClosed}
        className={className}
        nested={nested}
        renderTitle={renderTitle}
        persistMe={persistMe}
        title={title}
        onToggle={onToggle}
      >
        {children}
      </CollapsibleSectionWithPersistence>
    );
  }

  return (
    <CollapsibleSection
      id={id}
      defaultToClosed={defaultToClosed}
      className={className}
      nested={nested}
      renderTitle={renderTitle}
      title={title}
      onToggle={onToggle}
    >
      {children}
    </CollapsibleSection>
  );
};

const CollapsibleSectionWithPersistence: FC<OptionsGroupProps> = memo(props => {
  const [value, setValue] = useLocalStorage(getOptionGroupStorageKey(props.id), {
    defaultToClosed: props.defaultToClosed,
  });
  const onToggle = useCallback(
    (isExpanded: boolean) => {
      setValue({ defaultToClosed: !isExpanded });
      if (props.onToggle) {
        props.onToggle(isExpanded);
      }
    },
    [setValue, props.onToggle]
  );

  return <CollapsibleSection {...props} defaultToClosed={value.defaultToClosed} onToggle={onToggle} />;
});

const CollapsibleSection: FC<Omit<OptionsGroupProps, 'persistMe'>> = ({
  id,
  title,
  children,
  defaultToClosed,
  renderTitle,
  className,
  nested = false,
  onToggle,
}) => {
  const [isExpanded, toggleExpand] = useState(!defaultToClosed);
  const theme = useTheme();
  const styles = getStyles(theme, isExpanded, nested);
  useEffect(() => {
    if (onToggle) {
      onToggle(isExpanded);
    }
  }, [isExpanded]);

  return (
    <div className={cx(styles.box, className, 'options-group')}>
      <div
        className={styles.header}
        onClick={() => toggleExpand(!isExpanded)}
        aria-label={selectors.components.OptionsGroup.toggle(id)}
      >
        <div className={cx(styles.toggle, 'editor-options-group-toggle')}>
          <Icon name={isExpanded ? 'angle-down' : 'angle-right'} />
        </div>
        <div style={{ width: '100%' }}>{renderTitle ? renderTitle(isExpanded) : title}</div>
      </div>
      {isExpanded && <div className={styles.body}>{_.isFunction(children) ? children(toggleExpand) : children}</div>}
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme, isExpanded: boolean, isNested: boolean) => {
  return {
    box: cx(
      !isNested &&
        css`
          border-bottom: 1px solid ${theme.colors.pageHeaderBorder};
        `,
      isNested &&
        isExpanded &&
        css`
          margin-bottom: ${theme.spacing.formSpacingBase * 2}px;
        `
    ),
    toggle: css`
      color: ${theme.colors.textWeak};
      font-size: ${theme.typography.size.lg};
      margin-right: ${theme.spacing.sm};
    `,
    header: cx(
      css`
        display: flex;
        cursor: pointer;
        align-items: baseline;
        padding: ${theme.spacing.sm} ${theme.spacing.md} ${theme.spacing.sm} ${theme.spacing.sm};
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
        padding: 0 ${theme.spacing.md} ${theme.spacing.md} ${theme.spacing.xl};
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
