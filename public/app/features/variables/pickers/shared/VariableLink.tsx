import React, { FC, MouseEvent, useCallback } from 'react';
import { css } from '@emotion/css';
import { Icon, Tooltip, useStyles } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { GrafanaTheme } from '@grafana/data';

interface Props {
  onClick: () => void;
  text: string;
  loading: boolean;
  onCancel: () => void;
  /**
   *  htmlFor, needed for the label
   */
  id: string;
}

export const VariableLink: FC<Props> = ({ loading, onClick: propsOnClick, text, onCancel, id }) => {
  const styles = useStyles(getStyles);
  const onClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      event.preventDefault();
      propsOnClick();
    },
    [propsOnClick]
  );

  if (loading) {
    return (
      <div
        className={styles.container}
        data-testid={selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts(`${text}`)}
        title={text}
        id={id}
      >
        <VariableLinkText text={text} />
        <LoadingIndicator onCancel={onCancel} />
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={styles.container}
      data-testid={selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts(`${text}`)}
      aria-expanded={false}
      aria-controls={`options-${id}`}
      id={id}
      title={text}
    >
      <VariableLinkText text={text} />
      <Icon aria-hidden name="angle-down" size="sm" />
    </button>
  );
};

interface VariableLinkTextProps {
  text: string;
}

const VariableLinkText: FC<VariableLinkTextProps> = ({ text }) => {
  const styles = useStyles(getStyles);
  return <span className={styles.textAndTags}>{text}</span>;
};

const LoadingIndicator: FC<Pick<Props, 'onCancel'>> = ({ onCancel }) => {
  const onClick = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      onCancel();
    },
    [onCancel]
  );

  return (
    <Tooltip content="Cancel query">
      <Icon
        className="spin-clockwise"
        name="sync"
        size="xs"
        onClick={onClick}
        aria-label={selectors.components.LoadingIndicator.icon}
      />
    </Tooltip>
  );
};

const getStyles = (theme: GrafanaTheme) => ({
  container: css`
    max-width: 500px;
    padding-right: 10px;
    padding: 0 ${theme.spacing.sm};
    background-color: ${theme.colors.formInputBg};
    border: 1px solid ${theme.colors.formInputBorder};
    border-radius: ${theme.border.radius.sm};
    display: flex;
    align-items: center;
    color: ${theme.colors.text};
    height: ${theme.height.md}px;

    .label-tag {
      margin: 0 5px;
    }
  `,
  textAndTags: css`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-right: ${theme.spacing.xxs};
    user-select: none;
  `,
});
