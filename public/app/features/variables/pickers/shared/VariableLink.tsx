import React, { FC, MouseEvent, useCallback } from 'react';
import { css, cx } from 'emotion';
import { getTagColorsFromName, Icon, Tooltip, useStyles } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { GrafanaTheme } from '@grafana/data';

import { VariableTag } from '../../types';

interface Props {
  text: string;
  tags: VariableTag[];
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
  onCancel: () => void;
}

export const VariableLink: FC<Props> = ({ loading, onClick: propsOnClick, tags, text, onCancel, disabled }) => {
  const styles = useStyles(getStyles);
  const onClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      event.stopPropagation();
      event.preventDefault();
      if (!disabled && !loading) {
        propsOnClick();
        return;
      }
    },
    [propsOnClick, disabled, loading]
  );

  if (loading || disabled) {
    return (
      <div
        className={cx(styles.container, styles.loading)}
        aria-label={selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts(`${text}`)}
        title={text}
      >
        <VariableLinkText tags={tags} text={text} />
        {loading && <LoadingIndicator onCancel={onCancel} />}
      </div>
    );
  }

  return (
    <a
      onClick={onClick}
      className={styles.container}
      aria-label={selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts(`${text}`)}
      title={text}
    >
      <VariableLinkText tags={tags} text={text} />
      <Icon name="angle-down" size="sm" />
    </a>
  );
};

const VariableLinkText: FC<Pick<Props, 'tags' | 'text'>> = ({ tags, text }) => {
  const styles = useStyles(getStyles);
  return (
    <span className={styles.textAndTags}>
      {text}
      {tags.map((tag) => {
        const { color, borderColor } = getTagColorsFromName(tag.text.toString());
        return (
          <span key={`${tag.text}`}>
            <span className="label-tag" style={{ backgroundColor: color, borderColor }}>
              &nbsp;&nbsp;
              <Icon name="tag-alt" />
              &nbsp; {tag.text}
            </span>
          </span>
        );
      })}
    </span>
  );
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
  loading: css`
    cursor: not-allowed;
  `,
  textAndTags: css`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-right: ${theme.spacing.xxs};
    user-select: none;
  `,
});
