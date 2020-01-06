import React, { FunctionComponent, useContext } from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, ThemeContext } from '@grafana/ui';
import LayoutSelector, { LayoutMode } from '../LayoutSelector/LayoutSelector';
import { FilterInput } from '../FilterInput/FilterInput';

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  btn: css`
    background: ${theme.colors.primary};

    &:hover {
      background: ${theme.colors.primaryHover};
    }
  `,
}));

export interface Props {
  searchQuery: string;
  layoutMode?: LayoutMode;
  onSetLayoutMode?: (mode: LayoutMode) => {};
  setSearchQuery: (value: string) => {};
  linkButton: { href: string; title: string };
  target?: string;
}

const OrgActionBar: FunctionComponent<Props> = ({
  searchQuery,
  layoutMode,
  onSetLayoutMode,
  linkButton,
  setSearchQuery,
  target,
}) => {
  const linkProps = { href: linkButton.href };
  const theme = useContext(ThemeContext);
  const style = getStyles(theme);

  if (target) {
    (linkProps as any).target = target;
  }

  return (
    <div className="page-action-bar">
      <div className="gf-form gf-form--grow">
        <FilterInput
          labelClassName="gf-form--has-input-icon"
          inputClassName={`gf-form-input width-${layoutMode ? 20 : 24}`}
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={'Filter by name or type'}
        />
        {layoutMode ? (
          <LayoutSelector mode={layoutMode} onLayoutModeChanged={(mode: LayoutMode) => onSetLayoutMode(mode)} />
        ) : null}
      </div>
      <div className="page-action-bar__spacer" />
      <a className={cx('btn', 'btn-primary', style.btn)} {...linkProps}>
        {linkButton.title}
      </a>
    </div>
  );
};

export default OrgActionBar;
