import React, { PureComponent } from 'react';
import { getTagColorsFromName, Icon } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

import { VariableTag } from '../../types';
import { css } from 'emotion';

interface Props {
  onClick: () => void;
  text: string;
  tags: VariableTag[];
}
export class VariableLink extends PureComponent<Props> {
  onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    event.preventDefault();
    this.props.onClick();
  };

  render() {
    const { tags = [], text } = this.props;

    return (
      <a
        onClick={this.onClick}
        className="variable-value-link"
        aria-label={selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownValueLinkTexts(`${text}`)}
        title={text}
      >
        <span
          className={css`
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          `}
        >
          {text}
          {tags.map(tag => {
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
        <Icon name="angle-down" size="sm" />
      </a>
    );
  }
}
