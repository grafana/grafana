import { css, cx } from '@emotion/css';

import { GrafanaTheme2, renderMarkdown } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';
import { CompletionItem } from '../../types';

const getStyles = (theme: GrafanaTheme2, height: number, visible: boolean) => {
  return {
    typeaheadItem: css({
      label: 'type-ahead-item',
      zIndex: 11,
      padding: theme.spacing(1, 1, 1, 2),
      border: theme.colors.border.medium,
      overflowY: 'scroll',
      overflowX: 'hidden',
      outline: 'none',
      background: theme.colors.background.secondary,
      color: theme.colors.text.secondary,
      boxShadow: `0 0 20px ${theme.v1.colors.dropdownShadow}`,
      visibility: visible === true ? 'visible' : 'hidden',
      width: '250px',
      minHeight: `${height + parseInt(theme.spacing(0.25), 10)}px`,
      position: 'relative',
      wordBreak: 'break-word',
    }),
  };
};

interface Props {
  item: CompletionItem;
  height: number;
}

export const TypeaheadInfo = ({ item, height }: Props) => {
  const visible = item && !!item.documentation;
  const label = item ? item.label : '';
  const documentation = renderMarkdown(item?.documentation);
  const theme = useTheme2();
  const styles = getStyles(theme, height, visible);

  return (
    <div className={cx([styles.typeaheadItem])}>
      <b>{label}</b>
      <hr />
      <div dangerouslySetInnerHTML={{ __html: documentation }} />
    </div>
  );
};
