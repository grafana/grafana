import { css } from '@emotion/css';
import { MouseEvent, useCallback } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Icon, useStyles2 } from '@grafana/ui';
import { LoadingIndicator } from '@grafana/ui/internal';

import { getStyles as getTagBadgeStyles } from '../../../../core/components/TagFilter/TagBadge';
import { ALL_VARIABLE_TEXT } from '../../constants';

interface Props {
  onClick: () => void;
  text: string;
  loading: boolean;
  onCancel: () => void;
  disabled?: boolean;
  /**
   *  htmlFor, needed for the label
   */
  id: string;
}

export const VariableLink = ({ loading, disabled, onClick: propsOnClick, text, onCancel, id }: Props) => {
  const styles = useStyles2(getStyles);
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
        <LoadingIndicator loading onCancel={onCancel} />
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
      disabled={disabled}
    >
      <VariableLinkText text={text} />
      <Icon aria-hidden name="angle-down" size="sm" />
    </button>
  );
};

interface VariableLinkTextProps {
  text: string;
}

const VariableLinkText = ({ text }: VariableLinkTextProps) => {
  const styles = useStyles2(getStyles);

  return (
    <span className={styles.textAndTags}>
      {text === ALL_VARIABLE_TEXT ? t('variable.picker.link-all', 'All') : text}
    </span>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  const tagBadgeStyles = getTagBadgeStyles(theme);

  return {
    container: css({
      maxWidth: '500px',
      paddingRight: '10px',
      padding: theme.spacing(0, 1),
      backgroundColor: theme.components.input.background,
      border: `1px solid ${theme.components.input.borderColor}`,
      borderRadius: theme.shape.radius.default,
      display: 'flex',
      alignItems: 'center',
      color: theme.colors.text.primary,
      height: theme.spacing(theme.components.height.md),

      [`.${tagBadgeStyles.badge}`]: {
        margin: '0 5px',
      },

      '&:disabled': {
        backgroundColor: theme.colors.action.disabledBackground,
        color: theme.colors.action.disabledText,
        border: `1px solid ${theme.colors.action.disabledBackground}`,
      },
    }),
    textAndTags: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      marginRight: theme.spacing(0.25),
      userSelect: 'none',
    }),
  };
};
