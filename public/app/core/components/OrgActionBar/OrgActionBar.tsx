import React, { FunctionComponent } from 'react';
import LayoutSelector, { LayoutMode } from '../LayoutSelector/LayoutSelector';
import { FilterInput } from '../FilterInput/FilterInput';
import { LinkButton } from '@grafana/ui';

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
      <LinkButton variant={'secondary'} {...linkProps}>
        {linkButton.title}
      </LinkButton>
    </div>
  );
};

export default OrgActionBar;
