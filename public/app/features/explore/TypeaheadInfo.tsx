import React from 'react';
import { Themeable, GrafanaTheme, selectThemeVariant } from '@grafana/ui';
import { css, cx } from 'emotion';

import { CompletionItem } from 'app/types/explore';

interface Props extends Themeable {
  initialItem: CompletionItem;
  width: number;
  height: number;
}

interface State {
  item: CompletionItem;
}

export class TypeaheadInfo extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { item: props.initialItem };
  }

  getStyles = (theme: GrafanaTheme, visible: boolean) => ({
    typeaheadItem: css`
      label: type-ahead-item;
      z-index: auto;
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
      visibility: ${visible ? 'visible' : 'hidden'};
    `,
  });

  refresh = (item: CompletionItem) => {
    this.setState({ item });
  };

  hide = () => {
    this.setState({ item: null });
  };

  render() {
    const { item } = this.state;
    const { width, height, theme } = this.props;
    const visible = item && !!item.documentation;
    const label = item ? item.label : '';
    const documentation = item && item.documentation ? item.documentation : '';
    const styles = this.getStyles(theme, visible);

    return (
      <div
        className={cx([styles.typeaheadItem])}
        style={{ position: 'fixed', left: `${width + 164}px`, width: '250px', height: `${height + 1}px` }}
      >
        <b>{label}</b>
        <hr />
        <span>{documentation}</span>
      </div>
    );
  }
}
