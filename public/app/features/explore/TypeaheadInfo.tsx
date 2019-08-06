import React, { PureComponent } from 'react';
import { css, cx } from 'emotion';

import { Themeable, selectThemeVariant } from '@grafana/ui';

import { CompletionItem } from 'app/types/explore';

interface Props extends Themeable {
  item: CompletionItem;
  width: number;
  height: number;
}

export class TypeaheadInfo extends PureComponent<Props> {
  constructor(props: Props) {
    super(props);
  }

  getStyles = (visible: boolean) => {
    const { width, height, theme } = this.props;
    const selection = window.getSelection();
    const node = selection.anchorNode;

    if (!node) {
      return {};
    }

    // Read from DOM
    const rect = node.parentElement.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const left = `${rect.left + scrollX + width + parseInt(theme.spacing.xs, 10)}px`;
    const top = `${rect.top + scrollY + rect.height + 6}px`;

    return {
      typeaheadItem: css`
        label: type-ahead-item;
        z-index: 500;
        padding: ${theme.spacing.sm} ${theme.spacing.sm} ${theme.spacing.sm} ${theme.spacing.md};
        border-radius: ${theme.border.radius.md};
        border: ${selectThemeVariant(
          { light: `solid 1px ${theme.colors.gray5}`, dark: `solid 1px ${theme.colors.dark1}` },
          theme.type
        )};
        overflow-y: scroll;
        overflow-x: hidden;
        outline: none;
        background: ${selectThemeVariant({ light: theme.colors.white, dark: theme.colors.dark4 }, theme.type)};
        color: ${theme.colors.text};
        box-shadow: ${selectThemeVariant(
          { light: `0 5px 10px 0 ${theme.colors.gray5}`, dark: `0 5px 10px 0 ${theme.colors.black}` },
          theme.type
        )};
        visibility: ${visible === true ? 'visible' : 'hidden'};
        left: ${left};
        top: ${top};
        width: 250px;
        height: ${height + parseInt(theme.spacing.xxs, 10)}px;
        position: fixed;
      `,
    };
  };

  render() {
    const { item } = this.props;
    const visible = item && !!item.documentation;
    const label = item ? item.label : '';
    const documentation = item && item.documentation ? item.documentation : '';
    const styles = this.getStyles(visible);

    return (
      <div className={cx([styles.typeaheadItem])}>
        <b>{label}</b>
        <hr />
        <span>{documentation}</span>
      </div>
    );
  }
}
